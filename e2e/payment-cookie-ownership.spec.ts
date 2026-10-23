import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test as base, type Page } from "@playwright/test";
import { localFrontendOriginMiddleware } from "../vite/localFrontendOrigin";

const API_PATH = "/backend/celestia/api/v1";
const COOKIE_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const cookieName = (id: string) => `celestia_payment_${id.replaceAll("-", "")}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

type OwnershipObservation = { path: string; cookiePresent: boolean; authorized: boolean };
type Fixture = {
  frontendOrigin: string;
  apiOrigin: (hostname: "127.0.0.1" | "localhost") => string;
  observations: OwnershipObservation[];
};

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return (server.address() as AddressInfo).port;
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

async function readBody(request: IncomingMessage): Promise<{ transaction_id?: string }> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

const test = base.extend<{ fixture: Fixture; canonicalFrontend: boolean }>({
  canonicalFrontend: [false, { option: true }],
  fixture: async ({ browserName, canonicalFrontend }, provideFixture) => {
    expect(browserName).toBe("chromium");
    const frontend = createServer((request, response) => {
      const serveDocument = () => {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end("<!doctype html><title>Disposable cookie transport fixture</title>");
      };
      if (canonicalFrontend) localFrontendOriginMiddleware(frontendOrigin)(request, response, serveDocument);
      else serveDocument();
    });
    const frontendPort = await listen(frontend);
    const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
    const orders = new Map<string, string>();
    const observations: OwnershipObservation[] = [];
    const api = createServer(async (request, response) => {
      // Exact origin + credentials permit reading the response. They cannot
      // override the browser's SameSite cookie policy.
      response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
      response.setHeader("Vary", "Origin");
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "GET" && request.url === `${API_PATH}/fixture`) {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end("<!doctype html><title>Disposable API-origin fixture</title>");
        return;
      }
      if (request.method === "POST" && request.url === `${API_PATH}/transactions`) {
        await readBody(request);
        const id = randomUUID();
        const token = randomBytes(32).toString("base64url");
        orders.set(id, hash(token));
        // Mirrors transaction/handler/gateway.go for an HTTP frontend:
        // host-only (no Domain), Secure=false, HttpOnly, Lax, API path, seven days.
        response.setHeader("Set-Cookie", `${cookieName(id)}=${token}; Path=${API_PATH}; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_LIFETIME_SECONDS}; Expires=${new Date(Date.now() + COOKIE_LIFETIME_SECONDS * 1000).toUTCString()}`);
        json(response, 201, { success: true, data: { id, payment_provider: "DOKU", status: "WAITING_TO_PAYMENT" } });
        return;
      }
      const checkout = request.method === "POST" && request.url === `${API_PATH}/payments/checkout`;
      const status = request.method === "GET" && request.url?.startsWith(`${API_PATH}/payments/transactions/`);
      if (checkout || status) {
        const id = checkout ? (await readBody(request)).transaction_id : request.url?.split("/").at(-1);
        const name = cookieName(id ?? "");
        const token = request.headers.cookie?.split("; ").find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
        const authorized = Boolean(id && token && orders.get(id) === hash(token));
        observations.push({ path: request.url!, cookiePresent: Boolean(token), authorized });
        if (!authorized) {
          json(response, 401, { success: false, message: "checkout ownership is required" });
          return;
        }
        // This proves ownership transport only. No provider call or paid state.
        json(response, 200, { success: true, data: { transaction_id: id, status: "PENDING", verification_pending: false } });
        return;
      }
      json(response, 404, { success: false });
    });
    try {
      const apiPort = await listen(api);
      await provideFixture({ frontendOrigin, apiOrigin: (hostname) => `http://${hostname}:${apiPort}`, observations });
    } finally {
      await Promise.all([close(api), close(frontend)]);
    }
  },
});

async function createOrder(page: Page, apiOrigin: string) {
  return page.evaluate(async ({ apiOrigin, apiPath }) => {
    const response = await fetch(`${apiOrigin}${apiPath}/transactions`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_provider: "DOKU" }),
    });
    const body = await response.json();
    return { status: response.status, id: body.data.id as string };
  }, { apiOrigin, apiPath: API_PATH });
}

async function checkout(page: Page, apiOrigin: string, id: string) {
  return page.evaluate(async ({ apiOrigin, apiPath, id }) => {
    const response = await fetch(`${apiOrigin}${apiPath}/payments/checkout`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ transaction_id: id }),
    });
    return { status: response.status, body: await response.json() };
  }, { apiOrigin, apiPath: API_PATH, id });
}

test("127.0.0.1 SPA to localhost API loses ownership despite credentialed requests", async ({ page, fixture }) => {
  await page.goto(fixture.frontendOrigin);
  const order = await createOrder(page, fixture.apiOrigin("localhost"));
  expect(order.status).toBe(201);
  const result = await checkout(page, fixture.apiOrigin("localhost"), order.id);
  expect(result.status).toBe(401);
  expect(result.body.message).toBe("checkout ownership is required");
  expect(fixture.observations).toEqual([{ path: `${API_PATH}/payments/checkout`, cookiePresent: false, authorized: false }]);
});

test("matching 127.0.0.1 hosts retain HttpOnly ownership across ports and reload", async ({ page, context, fixture }) => {
  const apiOrigin = fixture.apiOrigin("127.0.0.1");
  expect(new URL(apiOrigin).port).not.toBe(new URL(fixture.frontendOrigin).port);
  await page.goto(fixture.frontendOrigin);
  const order = await createOrder(page, apiOrigin);
  expect(order.status).toBe(201);
  const cookie = (await context.cookies(`${apiOrigin}${API_PATH}/payments/checkout`)).find((value) => value.name === cookieName(order.id));
  expect(cookie).toMatchObject({ domain: "127.0.0.1", path: API_PATH, httpOnly: true, secure: false, sameSite: "Lax" });
  expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 6 * 24 * 60 * 60);
  const result = await checkout(page, apiOrigin, order.id);
  expect(result).toMatchObject({ status: 200, body: { success: true, data: { transaction_id: order.id, status: "PENDING" } } });
  await page.reload();
  const status = await page.evaluate(async ({ apiOrigin, apiPath, id }) => {
    const response = await fetch(`${apiOrigin}${apiPath}/payments/transactions/${id}`, { credentials: "include" });
    return { status: response.status, body: await response.json() };
  }, { apiOrigin, apiPath: API_PATH, id: order.id });
  expect(status).toMatchObject({ status: 200, body: { data: { status: "PENDING" } } });
  expect(fixture.observations).toHaveLength(2);
  expect(fixture.observations.every((value) => value.cookiePresent && value.authorized)).toBe(true);
  await page.goto(`${apiOrigin}${API_PATH}/fixture`);
  expect(await page.evaluate(() => document.cookie)).toBe("");
});

test("even an already-stored localhost Lax cookie is withheld from a 127.0.0.1 SPA", async ({ page, context, fixture }) => {
  const apiOrigin = fixture.apiOrigin("localhost");
  await page.goto(`${apiOrigin}${API_PATH}/fixture`);
  const order = await createOrder(page, apiOrigin);
  expect(order.status).toBe(201);
  expect((await context.cookies(`${apiOrigin}${API_PATH}`)).some((value) => value.name === cookieName(order.id))).toBe(true);
  await page.goto(fixture.frontendOrigin);
  expect((await checkout(page, apiOrigin, order.id)).status).toBe(401);
  expect(fixture.observations[0]).toMatchObject({ cookiePresent: false, authorized: false });
  expect((await context.cookies(`${apiOrigin}${API_PATH}`)).some((value) => value.name === cookieName(order.id))).toBe(true);
});

test.describe("canonical local frontend", () => {
  test.use({ canonicalFrontend: true });

  test("localhost navigation preserves the deep link and permits CORS and payment ownership", async ({ page, fixture }) => {
    const path = "/FBND/commerce/cart?from=payment%20selection#methods";
    const aliasOrigin = fixture.frontendOrigin.replace("127.0.0.1", "localhost");
    await page.goto(`${aliasOrigin}${path}`);
    await expect(page).toHaveURL(`${fixture.frontendOrigin}${path}`);
    const apiOrigin = fixture.apiOrigin("127.0.0.1");
    const order = await createOrder(page, apiOrigin);
    expect(order.status).toBe(201);
    expect((await checkout(page, apiOrigin, order.id)).status).toBe(200);
    await page.reload();
    expect((await checkout(page, apiOrigin, order.id)).status).toBe(200);
    expect(fixture.observations).toHaveLength(2);
    expect(fixture.observations.every((entry) => entry.cookiePresent && entry.authorized)).toBe(true);
  });

  test("redirect is temporary and limited to HTML navigation on the configured loopback port", async ({ request, fixture }) => {
    const alias = fixture.frontendOrigin.replace("127.0.0.1", "localhost");
    const redirected = await request.get(`${alias}/master/store/test?tab=payment`, {
      maxRedirects: 0, headers: { Accept: "text/html" },
    });
    expect(redirected.status()).toBe(302);
    expect(redirected.headers().location).toBe(`${fixture.frontendOrigin}/master/store/test?tab=payment`);
    expect(redirected.headers()["cache-control"]).toBe("no-store");
    const requests = [
      request.get(`${fixture.frontendOrigin}/`, { maxRedirects: 0, headers: { Accept: "text/html" } }),
      request.get(`${alias}/src/main.tsx`, { maxRedirects: 0, headers: { Accept: "*/*" } }),
      request.post(`${alias}/`, { maxRedirects: 0, headers: { Accept: "text/html" } }),
      request.get(`${alias}/`, { maxRedirects: 0, headers: { Accept: "text/html", Host: "example.com" } }),
      request.get(`${alias}/`, { maxRedirects: 0, headers: { Accept: "text/html", Host: "localhost:1" } }),
    ];
    for (const response of await Promise.all(requests)) {
      expect(response.status()).toBe(200);
      expect(response.headers().location).toBeUndefined();
    }
  });
});
