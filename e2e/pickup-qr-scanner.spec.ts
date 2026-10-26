import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

test.use({ video: "off" });
const payload = "celestia-pickup-v2.eyJ0cmFuc2FjdGlvbl9pZCI6InRlc3Qtb3JkZXIiLCJ0aW1lc3RhbXAiOjE3NjEyMDAwMDB9.signature-fixture";

async function staffSession(page: Page, context: BrowserContext, write = true) {
  await context.route("**/*", (route) => new URL(route.request().url()).origin === "http://127.0.0.1:4173" ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "scanner-staff", username: "Store Admin", email: "scanner@example.test", role: "staff_internal", role_id: "scanner-role" }));
    localStorage.setItem("argopos.auth.token", "mock-scanner-jwt");
  });
  const requests: string[] = [];
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname;
    const json = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (endpoint.endsWith("/with-access")) return json({ id: "scanner-role", role_name: "staff_internal", access_roles: ["dashboard", "transactions", "customers", "master_stores"].map((menu) => ({ id: menu, access_type: write ? "write" : "read", menu: { id: menu, menu_name: menu } })) });
    if (endpoint.endsWith("/users/")) return json({ id: "scanner-staff", role: { role_name: "staff_internal" }, assigned_stores: [{ id: "scanner-store", location_name: "Scanner Store" }] });
    if (endpoint.endsWith("/transactions/required/confirm-pickup-qr")) {
      expect(request.method()).toBe("POST");
      expect(request.headers().authorization).toBe("Bearer mock-scanner-jwt");
      expect(request.postDataJSON()).toEqual({ qr_payload: payload });
      requests.push(request.postDataJSON().qr_payload);
      return json({ transaction_id: "test-order", transaction_code: "TRX-DOKU-QR-TEST", status: "COMPLETED", already_completed: requests.length > 1 });
    }
    if (endpoint.endsWith("/transactions/required")) return json({ transactions: [], meta: { total: 0, page: 1, page_size: 20 } });
    return json([]);
  });
  return requests;
}

async function qrImage(context: BrowserContext) {
  const imagePage = await context.newPage();
  await imagePage.setContent(renderToStaticMarkup(createElement(QRCodeSVG, { value: payload, size: 360, marginSize: 4, level: "M" })));
  const buffer = await imagePage.locator("svg").screenshot();
  await imagePage.close();
  return { name: "customer-qr.png", mimeType: "image/png", buffer };
}

for (const width of [390, 820, 1440]) {
  test(`central scanner and real image decoding at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    const requests = await staffSession(page, context);
    await page.goto("/transactions");
    const scan = page.getByRole("link", { name: "Scan QR penyerahan" });
    await expect(scan).toBeVisible();
    const bounds = await scan.boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(950);
    await scan.click();
    await expect(page.getByRole("heading", { name: "Konfirmasi penyerahan barang" })).toBeVisible();
    await expect(scan).toBeVisible();
    expect(requests).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath("pickup-scanner.png"), fullPage: true });
    await page.getByLabel("Gambar QR penyerahan").setInputFiles(await qrImage(context));
    await expect(page.getByRole("heading", { name: "Penyerahan berhasil" })).toBeVisible();
    await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath("pickup-confirmed.png"), fullPage: true });
    await page.getByRole("button", { name: "Pindai pesanan berikutnya" }).click();
    await page.getByLabel("Gambar QR penyerahan").setInputFiles(await qrImage(context));
    await expect(page.getByRole("heading", { name: "Pesanan sudah diserahkan" })).toBeVisible();
    expect(requests).toHaveLength(2);
  });
}

test("denied camera permission allows image recovery without a completion request", async ({ page, context }) => {
  const requests = await staffSession(page, context);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: {
      getUserMedia: async () => { throw new DOMException("Permission denied", "NotAllowedError"); },
    } });
  });
  await page.goto("/transactions/pickup-scan");
  await page.getByRole("button", { name: "Aktifkan kamera" }).click();
  await expect(page.getByRole("alert")).toContainText("Akses kamera ditolak");
  await expect(page.getByRole("button", { name: "Unggah gambar QR" })).toBeEnabled();
  expect(requests).toHaveLength(0);
});

test("camera stream decodes a QR once and releases the video track on success", async ({ page, context }) => {
  const requests = await staffSession(page, context);
  const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: payload, size: 360, marginSize: 4, level: "M", xmlns: "http://www.w3.org/2000/svg" }));
  await page.addInitScript(({ svg }) => {
    Object.defineProperty(navigator, "mediaDevices", { value: {
      enumerateDevices: async () => [],
      getUserMedia: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 360; canvas.height = 360;
        const image = new Image();
        image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        await image.decode();
        const paint = () => canvas.getContext("2d")!.drawImage(image, 0, 0);
        paint();
        const timer = setInterval(paint, 100);
        const stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); document.documentElement.dataset.cameraStopped = "true"; };
        return stream;
      },
    } });
  }, { svg });
  await page.goto("/transactions/pickup-scan");
  await page.getByRole("button", { name: "Aktifkan kamera" }).click();
  await expect(page.getByRole("heading", { name: "Penyerahan berhasil" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-camera-stopped", "true");
  expect(requests).toHaveLength(1);
});

test("read-only staff cannot open scanner or see its navigation action", async ({ page, context }) => {
  const requests = await staffSession(page, context, false);
  await page.goto("/transactions");
  await expect(page.getByRole("link", { name: "Scan QR penyerahan" })).toHaveCount(0);
  await page.goto("/transactions/pickup-scan");
  await expect(page.getByRole("alert")).toContainText("You don't have permission to modify this page.");
  await expect(page.getByLabel("Gambar QR penyerahan")).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
