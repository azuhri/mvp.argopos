import { expect, test } from "@playwright/test";

const locationId = "0d43fee5-6dd3-4050-8cb9-b107cfbe2043";

test("store payment tab persists exclusive modes and preserves manual methods (mock API)", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "settings-admin", username: "Admin", email: "admin@example.test", role: "super_admin", role_id: "settings-role" }));
    localStorage.setItem("argopos.auth.token", "mock-settings-token");
  });
  let mode = "MANUAL";
  let writes = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (url.pathname.endsWith("/with-access")) return json({ id: "settings-role", role_name: "super_admin", access_roles: [{ id: "settings-access", access_type: "write", menu: { id: "stores-menu", menu_name: "master_stores" } }] });
    if (url.pathname.endsWith("/users/")) return json({ id: "settings-admin", assigned_stores: [] });
    if (url.pathname.endsWith(`/stores/${locationId}/payment-settings`)) {
      if (request.method() === "PUT") {
        expect(request.headers().authorization).toBe("Bearer mock-settings-token");
        expect(Object.keys(request.postDataJSON())).toEqual(["payment_mode"]);
        mode = request.postDataJSON().payment_mode;
        writes += 1;
      }
      return json({ location_id: locationId, payment_mode: mode, doku_available: true, doku_methods: ["QRIS", "VIRTUAL_ACCOUNT_BCA"] });
    }
    if (url.pathname.endsWith(`/stores/${locationId}`)) return json({
      location_id: locationId, location_name: "Celestia Store", location_code: "CL-01", status: "active",
      total_revenue: 0, total_transactions: 0, total_stock: 0, product_stores: [], assigned_users: [],
      payment_methods: [{ id: "manual-bank", location_id: locationId, payment_type: "transfer_rekening", image_url: "", bank_name: "BCA", account_number: "0000000000", account_name: "Celestia Test Store", is_active: true }],
    });
    return json([]);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/master/store/${locationId}?tab=payment`);
  await expect(page.getByRole("heading", { name: "Pengaturan Pembayaran" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Manual Payment/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Metode Pembayaran Manual" })).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole("radio", { name: /^Payment gateway with DOKU/ }).check();
  await expect(page.getByText("Perubahan mode belum disimpan.")).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Simpan mode pembayaran" }).click();
  await expect(page.getByText("Aktif: DOKU", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Payment gateway with DOKU/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Metode Pembayaran Manual" })).not.toBeVisible();
  await expect(page.getByText("DOKU Checkout siap digunakan")).toBeVisible();
  await expect(page.locator(".glass-card").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".glass-card").last()).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("store-payment-settings-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("store-payment-settings-mobile.png"), fullPage: true });
  await page.getByRole("radio", { name: /^Manual Payment/ }).check();
  await page.getByRole("button", { name: "Simpan mode pembayaran" }).click();
  await expect(page.getByText("Aktif: Manual Payment", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Manual Payment/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Metode Pembayaran Manual" })).toBeVisible();
  await expect(page.getByText("Celestia Test Store").filter({ visible: true })).toBeVisible();
  expect(writes).toBe(2);
});

test("assigned staff can refresh newly granted store permission and save DOKU without signing out (mock API)", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "assigned-staff", username: "Staff", email: "staff@example.test", role: "staff_internal", role_id: "staff-role" }));
    localStorage.setItem("argopos.auth.token", "mock-staff-token");
  });
  let writes = 0;
  let permissionGranted = false;
  let permissionReads = 0;
  let mode = "MANUAL";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (request.method() !== "GET") writes += 1;
    if (url.pathname.endsWith("/with-access")) {
      permissionReads += 1;
      return json({ id: "staff-role", role_name: "staff_internal", access_roles: permissionGranted ? [{ id: "staff-store-access", access_type: "write", menu: { id: "store-menu", menu_name: "master_stores" } }] : [] });
    }
    if (url.pathname.endsWith("/users/")) return json({ id: "assigned-staff", assigned_stores: [{ id: locationId }] });
    if (url.pathname.endsWith(`/stores/${locationId}/payment-settings`)) {
      if (request.method() === "PUT") {
        expect(permissionGranted).toBe(true);
        expect(request.headers().authorization).toBe("Bearer mock-staff-token");
        mode = request.postDataJSON().payment_mode;
      }
      return json({ location_id: locationId, payment_mode: mode, doku_available: false, doku_methods: [] });
    }
    if (url.pathname.endsWith(`/stores/${locationId}`)) return json({
      location_id: locationId, location_name: "Celestia Store", location_code: "CL-01", status: "active",
      total_revenue: 0, total_transactions: 0, total_stock: 0, product_stores: [], payment_methods: [],
      assigned_users: [{ id: "assigned-staff", username: "Staff", role: "staff_internal" }],
    });
    return json([]);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/master/store/${locationId}?tab=payment`);
  await expect(page.getByRole("radio", { name: /^Manual Payment/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /^Payment gateway with DOKU/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Simpan mode pembayaran" })).not.toBeVisible();
  await expect(page.getByText(/belum memiliki izin/i)).toBeVisible();
  await expect(page.locator(".glass-card").first()).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("payment-permission-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText(/belum memiliki izin/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("payment-permission-mobile.png"), fullPage: true });
  expect(writes).toBe(0);
  // Simulate an administrator granting access in another session.
  permissionGranted = true;
  const readsBeforeRefresh = permissionReads;
  await page.getByRole("button", { name: "Periksa ulang akses" }).click();
  await expect.poll(() => permissionReads).toBeGreaterThan(readsBeforeRefresh);
  await expect(page.getByRole("radio", { name: /^Payment gateway with DOKU/ })).toBeEnabled();
  await expect(page.getByText("Akses hanya lihat", { exact: true })).not.toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole("radio", { name: /^Payment gateway with DOKU/ }).check();
  await expect(page.getByText("DOKU Checkout belum tersedia", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simpan mode pembayaran" }).click();
  await expect(page.getByText("Aktif: DOKU", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
});
