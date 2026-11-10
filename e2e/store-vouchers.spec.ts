import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const storeId = "34785bd6-7405-4260-9e8c-250a20b0e32e";

async function captureStablePage(page: Page, path: string) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
}

test("CMS voucher create, edit, trace and settle work on desktop and mobile (fixture API)", async ({ context, page }, testInfo) => {
  await context.addInitScript(() => {
    localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "voucher-admin", username: "Admin", email: "admin@example.test", role: "super_admin", role_id: "voucher-role" }));
    localStorage.setItem("argopos.auth.token", "fixture-voucher-token");
  });
  const vouchers: Record<string, unknown>[] = [];
  const writes: Record<string, unknown>[] = [];
  let settled = false;
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    const json = (data: unknown, total?: number) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data, meta: { total } }) });
    if (path.endsWith("/with-access")) return json({ id: "voucher-role", role_name: "super_admin", access_roles: ["master_stores", "transactions"].map((name) => ({ id: name, access_type: "write", menu: { id: name, menu_name: name } })) });
    if (path.endsWith("/users/")) return json({ id: "voucher-admin", assigned_stores: [] });
    if (path.endsWith(`/stores/${storeId}`)) return json({ location_id: storeId, location_name: "Voucher Test Store", location_code: "WAM", status: "active", product_stores: [], assigned_users: [], payment_methods: [], total_stock: 0, total_revenue: 0, total_transactions: 0 });
    if (path.endsWith("/vouchers") && request.method() === "POST") {
      const body = request.postDataJSON(); writes.push(body);
      const voucher = { ...body, code: body.code || "RANDOM123", id: `v-${vouchers.length + 1}`, location_id: storeId, created_by: "voucher-admin", creator_name: "Store Admin", created_at: new Date().toISOString() };
      vouchers.push(voucher); return json(voucher);
    }
    if (path.includes("/vouchers/v-") && request.method() === "PUT") {
      const body = request.postDataJSON(); writes.push(body);
      const index = vouchers.findIndex((item) => path.endsWith(`/${item.id}`));
      vouchers[index] = { ...vouchers[index], ...body }; return json(vouchers[index]);
    }
    if (path.endsWith("/vouchers")) return json(vouchers);
    if (path.includes("/voucher-transactions")) {
      if (request.method() === "POST") { expect(path).toMatch(/\/tx-voucher\/settle$/); settled = true; }
      const item = { id: "tx-voucher", transaction_code: "TRX-VOUCHER-TEST", customer_name: "Fixture Customer", status: "PAID", paid_at: new Date().toISOString(), total_amount: 30000, base_amount: 50000, voucher_code: "HEMAT20", discount_amount: 20000, voucher_settlement_required: true, voucher_settlement_status: settled ? "SETTLED" : "UNSETTLED", voucher_settled_at: settled ? new Date().toISOString() : null, settled_by_name: "Store Admin" };
      return json(request.method() === "POST" ? item : [item], 1);
    }
    return json([]); // All business requests are intercepted; no live company writes.
  });
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/master/store/${storeId}?tab=vouchers`);
  await page.getByRole("button", { name: "Tambah voucher", exact: true }).click();
  await page.getByLabel("Kode voucher", { exact: true }).fill("hemat20");
  await expect(page.getByLabel("Kode voucher", { exact: true })).toHaveValue("HEMAT20");
  await page.getByRole("switch", { name: "Settlement aktif", exact: true }).click();
  await page.getByRole("button", { name: "Simpan voucher", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit voucher HEMAT20", exact: true })).toBeVisible();
  expect(writes[0]).toMatchObject({ code: "HEMAT20", discount_type: "FIXED", discount_value: 20000, expires_at: null, requires_settlement: true });
  expect(writes[0]).not.toHaveProperty("created_by");
  await page.getByRole("button", { name: "Edit voucher HEMAT20", exact: true }).click();
  await page.getByLabel("Jenis diskon").selectOption("PERCENTAGE");
  await page.getByLabel("Persentase diskon (%)").fill("15");
  await page.getByLabel("Kedaluwarsa (waktu lokal)").fill("2030-12-31T18:00");
  await page.getByRole("button", { name: "Simpan voucher", exact: true }).click();
  await expect(page.getByText("15%", { exact: true })).toBeVisible();
  expect(writes[1]).toMatchObject({ code: "HEMAT20", discount_type: "PERCENTAGE", discount_value: 15 });
  await captureStablePage(page, testInfo.outputPath("voucher-cms-desktop.png"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Tambah voucher", exact: true }).click();
  await page.getByLabel("Pembuatan kode").selectOption("random");
  await expect(page.getByLabel("Kode voucher", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Simpan voucher", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit voucher RANDOM123", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tandai SETTLED", exact: true }).click();
  expect(settled).toBe(false);
  await page.getByRole("button", { name: "Konfirmasi SETTLED", exact: true }).click();
  await expect(page.getByText("SETTLED", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tandai SETTLED", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await captureStablePage(page, testInfo.outputPath("voucher-cms-mobile.png"));
  expect(errors).toEqual([]);
});

async function checkoutFixture(context: BrowserContext, provider: "MANUAL" | "DOKU", options: { staleCart?: boolean; excessQuantity?: boolean } = {}) {
  const state = { submissions: [] as Record<string, unknown>[], quotes: [] as Record<string, unknown>[] };
  const stockId = options.staleCart ? "d3529f87-99a0-4bdf-9b81-fc06982127c7" : "stock";
  const gross = options.staleCart ? 150000 : 100000;
  const order = { id: "voucher-order", transaction_code: "TRX-VOUCHER", master_location_id: storeId, payment_provider: provider, status: "WAITING_TO_PAYMENT", base_amount: gross, discount_amount: 20000, voucher_code: "HEMAT20", total_amount: gross - 20000, total_item: options.staleCart ? 3 : 2, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), transaction_carts: [] };
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data }) });
    if (path.endsWith("/location/stores")) return json([{ id: storeId, location_code: "WAM", location_name: "Voucher Store", type: "store", status: "active" }]);
    if (path.endsWith("/WAM/store")) return json({ location_id: storeId, location_code: "WAM", location_name: "Voucher Store", product_stores: [{ id: stockId, stock: options.staleCart ? 100 : 4, base_price: 50000, final_price: 50000, master_product: { id: "product", product_name: "Produk Test", image_url: "/image/POKPOK%20PACKSHOT.png" } }] });
    if (path.endsWith("/payment-settings")) return json({ location_id: storeId, payment_mode: provider, doku_available: true, doku_methods: ["VIRTUAL_ACCOUNT_BCA"] });
    if (path.endsWith("/payment-methods")) return json([{ id: "manual-one", payment_type: "cutoff_hutang", is_active: true }]);
    if (path.endsWith("/assigned-users")) return json([]);
    if (path.endsWith("/operational-status")) return json({ is_open: true, current_time: "10:00", is_within_pickup_window: true });
    if (path.endsWith("/check-valid-employee")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, is_valid: true }) });
    if (path.endsWith("/vouchers/quote")) {
      const body = request.postDataJSON(); state.quotes.push(body);
      expect(Object.keys(body).sort()).toEqual(["carts", "voucher_code"]);
      if (body.voucher_code === "EXPIRED") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Voucher telah kedaluwarsa" } }) });
      if (body.voucher_code === "CELESTIA") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Voucher tidak tersedia pada toko ini" } }) });
      const base = body.carts[0].qty * 50000;
      return json({ voucher_code: "HEMAT20", discount_type: "FIXED", discount_value: 20000, base_amount: base, discount_amount: 20000, payable_amount: base - 20000, expires_at: null, requires_settlement: true });
    }
    if (path.endsWith("/transactions") && request.method() === "POST") { state.submissions.push(request.postDataJSON()); return json(order); }
    if (path.endsWith("/transactions/voucher-order")) return json(path.includes("/payments/") ? { transaction_id: order.id, status: "PENDING", creation_state: "UNCERTAIN", verification_pending: true, amount: 80000 } : order);
    if (path.endsWith("/payments/checkout")) return json({ transaction_id: order.id, status: "PENDING", creation_state: "UNCERTAIN", verification_pending: true }, 202);
    return json([], 501);
  });
  await context.addInitScript(({ stockId, staleCart, excessQuantity }) => {
    localStorage.setItem("selectedLocationCode", "WAM");
    sessionStorage.setItem("argopos.commerce.location-confirmed.v1", "WAM");
    const rows = [{ productId: stockId, qty: staleCart ? 3 : excessQuantity ? 10 : 1, productName: staleCart ? "Nama tersimpan" : "Produk Test", productPrice: staleCart ? 1000 : 50000, productStock: excessQuantity ? 10 : 4, productImageUrl: "/image/POKPOK%20PACKSHOT.png", tax_percentage: 0 }];
    if (staleCart) rows.unshift({ ...rows[0], productId: "64133324-5e98-4dcc-b3e1-905d82d285e3", qty: 1, productName: "Produk lama", productPrice: 60000 });
    localStorage.setItem("argopos.store.cart", JSON.stringify(rows));
  }, { stockId, ...options });
  return state;
}

for (const provider of ["MANUAL", "DOKU"] as const) test(`checkout ${provider} validates voucher, invalidates changed carts and sends only its code`, async ({ page, context }, testInfo) => {
  const state = await checkoutFixture(context, provider);
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: provider === "MANUAL" ? 390 : 1440, height: 1000 });
  await page.goto("/WAM/commerce/cart");
  await page.getByRole("button", { name: "Karyawan internal", exact: true }).click();
  await page.getByLabel("Nomor WhatsApp / ponsel karyawan", { exact: true }).fill("081234567890");
  await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toBeVisible();
  if (provider === "MANUAL") await page.getByText("Cutoff / Hutang", { exact: true }).click();
  await page.getByLabel("Kode voucher (opsional)").fill("expired");
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText("Voucher telah kedaluwarsa", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  expect(state.submissions).toHaveLength(0);
  await page.getByLabel("Kode voucher (opsional)").fill("hemat20");
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText(/HEMAT20: hemat/)).toBeVisible();
  await page.getByRole("button", { name: "Tambah Produk Test", exact: true }).click();
  await expect(page.getByText(/HEMAT20: hemat/)).toHaveCount(0);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  expect(state.submissions).toHaveLength(0);
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText(/HEMAT20: hemat/)).toBeVisible();
  await expect(page.getByText("Rp 80.000", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await captureStablePage(page, testInfo.outputPath(`voucher-checkout-${provider}.png`));
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  if (provider === "DOKU") {
    await expect(page.getByRole("dialog").getByText("Rp 80.000", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Virtual Account BCA" }).click();
    expect(state.submissions).toHaveLength(0);
    await page.getByRole("button", { name: "Konfirmasi dan bayar", exact: true }).click();
  }
  await expect(page).toHaveURL(provider === "DOKU" ? /\/WAM\/commerce\/payment-maintenance\/voucher-order$/ : /\/WAM\/commerce\/payment\/voucher-order$/);
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0]).toMatchObject({ voucher_code: "HEMAT20", carts: [{ product_stock_id: "stock", qty: 2 }] });
  expect(state.submissions[0]).not.toHaveProperty("discount_amount");
  expect(state.submissions[0]).not.toHaveProperty("voucher_settlement_status");
  if (provider === "MANUAL") await expect(page.getByText("Voucher HEMAT20", { exact: true })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Pembayaran sedang maintenance" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const provider of ["MANUAL", "DOKU"] as const) test(`checkout ${provider} retains stale stock until explicit removal and blocks voucher and order requests`, async ({ page, context }, testInfo) => {
  const state = await checkoutFixture(context, provider, { staleCart: true });
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: provider === "MANUAL" ? 390 : 1440, height: 1000 });
  await page.goto("/WAM/commerce/cart");
  await expect(page.getByRole("heading", { name: "Produk lama", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Produk Test", exact: true })).toBeVisible();
  await expect(page.getByText("Nama tersimpan", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Produk tidak tersedia di toko ini. Hapus untuk melanjutkan.", { exact: true })).toBeVisible();
  await page.getByLabel("Kode voucher (opsional)").fill("CELESTIA");
  await expect(page.getByRole("button", { name: "Terapkan", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true })).toBeDisabled();
  expect(state.quotes).toHaveLength(0);
  expect(state.submissions).toHaveLength(0);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.cart") || "[]"));
  expect(original.map((item: { productId: string }) => item.productId)).toEqual(["64133324-5e98-4dcc-b3e1-905d82d285e3", "d3529f87-99a0-4bdf-9b81-fc06982127c7"]);
  await captureStablePage(page, testInfo.outputPath(`stale-cart-${provider}.png`));
  await page.getByRole("button", { name: "Hapus produk tidak tersedia", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Produk lama", exact: true })).toHaveCount(0);
  const cleaned = await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.cart") || "[]"));
  expect(cleaned).toHaveLength(1);
  expect(cleaned[0]).toMatchObject({ productId: "d3529f87-99a0-4bdf-9b81-fc06982127c7", qty: 3 });
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText("Voucher tidak tersedia pada toko ini", { exact: true })).toBeVisible();
  expect(state.quotes[0]).toEqual({ voucher_code: "CELESTIA", carts: [{ product_stock_id: "d3529f87-99a0-4bdf-9b81-fc06982127c7", qty: 3 }] });
  await page.getByLabel("Kode voucher (opsional)").fill("HEMAT20");
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText(/HEMAT20: hemat/)).toBeVisible();
  await expect(page.getByText("Rp 130.000", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await captureStablePage(page, testInfo.outputPath(`reconciled-cart-${provider}.png`));
  await page.getByRole("button", { name: "Karyawan internal", exact: true }).click();
  await page.getByLabel("Nomor WhatsApp / ponsel karyawan", { exact: true }).fill("081234567890");
  await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toBeVisible();
  if (provider === "MANUAL") await page.getByText("Cutoff / Hutang", { exact: true }).click();
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  if (provider === "DOKU") {
    await page.getByRole("radio", { name: "Virtual Account BCA" }).click();
    await page.getByRole("button", { name: "Konfirmasi dan bayar", exact: true }).click();
  }
  await expect(page).toHaveURL(provider === "DOKU" ? /\/WAM\/commerce\/payment-maintenance\/voucher-order$/ : /\/WAM\/commerce\/payment\/voucher-order$/);
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0]).toMatchObject({ voucher_code: "HEMAT20", carts: [{ product_stock_id: "d3529f87-99a0-4bdf-9b81-fc06982127c7", qty: 3 }] });
  expect(errors).toEqual([]);
});

test("checkout requires explicit quantity adjustment when current stock is below the stored quantity", async ({ page, context }) => {
  const state = await checkoutFixture(context, "MANUAL", { excessQuantity: true });
  await page.goto("/WAM/commerce/cart");
  await expect(page.getByText("Stok saat ini 4. Kurangi jumlah atau hapus produk.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true })).toBeDisabled();
  await page.getByLabel("Kode voucher (opsional)").fill("HEMAT20");
  await expect(page.getByRole("button", { name: "Terapkan", exact: true })).toBeDisabled();
  expect(state.quotes).toHaveLength(0);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.cart") || "[]")))[0].qty).toBe(10);
  await page.getByRole("button", { name: "Sesuaikan menjadi 4 item", exact: true }).click();
  await expect(page.getByText("Stok saat ini 4. Kurangi jumlah atau hapus produk.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
  await expect(page.getByText(/HEMAT20: hemat/)).toBeVisible();
  expect(state.quotes[0]).toEqual({ voucher_code: "HEMAT20", carts: [{ product_stock_id: "stock", qty: 4 }] });
  expect(state.submissions).toHaveLength(0);
});
