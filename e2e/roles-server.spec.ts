import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Opt-in only: the backend integration test creates this short-lived fixture
// against a disposable PostgreSQL database. Never point this at a company API.
const fixturePath = process.env.CELESTIA_ROLE_HTTP_FIXTURE;
type Actor = { token: string; user: { id: string; username: string; email: string; role: string; role_id: string; created_at: string; updated_at: string } };
type ServerFixture = Actor & { api_url: string; reader: Actor; menus: Record<string, string> };
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) as ServerFixture : undefined;
test.skip(!fixture, "Requires an explicitly started disposable backend fixture");

async function connectToFixture(page: Page, actor: Actor) {
  if (!fixture || fixture.api_url !== "http://127.0.0.1:55580/backend/celestia/api/v1") throw new Error("Only the loopback disposable role fixture is permitted");
  const errors: string[] = [];
  const requests: Array<{ method: string; path: string; status: number }> = [];
  const unexpectedRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem("argopos.auth.user", JSON.stringify(user));
    localStorage.setItem("argopos.auth.token", token);
  }, actor);
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/api/v1")[1];
    if (!/^\/(users\/?|menus\/list|access-roles\/(roles|role(?:\/[^/]+(?:\/with-access)?)?))$/.test(path)) {
      unexpectedRequests.push(`${request.method()} ${path}`);
      await route.abort();
      return;
    }
    // Transport proxy only: actual Fiber response and PostgreSQL-backed data,
    // with original HTTP method, request body and Authorization header preserved.
    const response = await route.fetch({ url: `${fixture.api_url}${path}${url.search}` });
    requests.push({ method: request.method(), path, status: response.status() });
    await route.fulfill({ response });
  });
  return { errors, requests, unexpectedRequests, consoleErrors };
}

test("real Fiber and PostgreSQL persist role creation and edited menu access from the browser", async ({ page }, testInfo) => {
  const captured = await connectToFixture(page, fixture!);
  const roleName = `browser_qa_${Date.now()}`;
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/master/roles/new");
  await expect(page.getByRole("heading", { name: "Tambah Role", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /: Hidden$/, checked: true })).toHaveCount(12);
  await page.getByLabel("Nama role", { exact: false }).fill(roleName);
  await page.getByLabel("Deskripsi", { exact: true }).fill("Browser to Fiber to disposable PostgreSQL");
  await page.getByRole("radio", { name: "Transactions: Read", exact: true }).check();
  const createdResponse = page.waitForResponse(response => response.url().endsWith("/access-roles/role") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Buat Role", exact: true }).click();
  const response = await createdResponse;
  expect(response.ok()).toBe(true);
  const created = await response.json() as { success: boolean; data: { id: string; role_name: string } };
  expect(created.success).toBe(true);
  expect(created.data.role_name).toBe(roleName);
  expect(created.data.id).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page).toHaveURL(/\/master\/roles$/);
  await page.reload();
  const row = page.getByRole("row", { name: `Role ${roleName}`, exact: true });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Pembayaran DOKU: Hidden", exact: true })).toBeChecked();
  await page.getByLabel("Deskripsi", { exact: true }).fill("Persisted independent Transactions and DOKU permissions");
  await page.getByRole("radio", { name: "Transactions: Write", exact: true }).check();
  await page.getByRole("radio", { name: "Pembayaran DOKU: Read", exact: true }).check();
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/master\/roles$/);
  await page.reload();
  await row.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByLabel("Deskripsi", { exact: true })).toHaveValue("Persisted independent Transactions and DOKU permissions");
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Pembayaran DOKU: Read", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Role Management: Hidden", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("roles-real-server-persisted.png"), fullPage: true, animations: "disabled" });
  await testInfo.attach("role-http-evidence", { body: JSON.stringify({ role_id: created.data.id, role_name: roleName, requests: captured.requests }, null, 2), contentType: "application/json" });
  expect(captured.requests.filter(item => item.method === "POST" && item.status < 300)).toHaveLength(1);
  expect(captured.requests.filter(item => item.method === "PUT" && item.status < 300)).toHaveLength(1);
  expect(captured.requests.filter(item => item.status >= 400)).toEqual([]);
  expect(captured.unexpectedRequests).toEqual([]);
  expect(captured.errors).toEqual([]);
  expect(captured.consoleErrors).toEqual([]);
});

test("real server denies a forged role write from a read-only browser session", async ({ page }) => {
  const captured = await connectToFixture(page, fixture!.reader);
  await page.goto("/master/roles");
  await expect(page.getByRole("main").getByRole("heading", { name: "Role Management", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tambah Role", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy Permissions", exact: true })).toHaveCount(0);
  const status = await page.evaluate(async () => {
    const response = await fetch("/backend/celestia/api/v1/access-roles/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("argopos.auth.token")}` },
      body: JSON.stringify({ role_name: "forbidden_browser_creation", description: "Must not be saved", menu_accesses: [] }),
    });
    return response.status;
  });
  expect(status).toBe(403);
  await page.reload();
  await expect(page.getByText("forbidden_browser_creation", { exact: true })).toHaveCount(0);
  await page.goto("/master/roles/new");
  await expect(page.getByRole("alert")).toContainText(/permission|akses/i);
  expect(captured.requests.filter(item => item.method === "POST")).toEqual([{ method: "POST", path: "/access-roles/role", status: 403 }]);
  expect(captured.unexpectedRequests).toEqual([]);
  expect(captured.errors).toEqual([]);
  expect(captured.consoleErrors.filter(message => !message.startsWith("Failed to load resource: the server responded with a status of 403 "))).toEqual([]);
});
