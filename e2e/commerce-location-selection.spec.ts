import { expect, test, type BrowserContext } from "@playwright/test";

test.use({ video: "off" });

const confirmedKey = "argopos.commerce.location-confirmed.v1";
const cartKey = "argopos.store.cart";
const stores = [
  { id: "store-a", location_code: "OUTLET-A", location_name: "Farm Benda", type: "store", status: "active", is_active: true },
  { id: "store-b", location_code: "OUTLET-B", location_name: "Wisma Argo Manunggal", type: "store", status: "active", is_active: true },
  { id: "store-off", location_code: "OFF", location_name: "Lokasi Nonaktif", type: "store", status: "inactive", is_active: false },
];
const cart = [{ productId: "stock-a", productStockId: "stock-a", qty: 1, productName: "Produk Farm Benda", productPrice: 25000, productStock: 10 }];

async function fixtures(context: BrowserContext, initial: { saved?: string; confirmed?: string; cart?: boolean } = {}) {
  const state = { stores: [...stores], listError: false, listReads: 0, catalogs: [] as string[], mutations: 0,
    settingsGate: undefined as Promise<void> | undefined, settingsWaits: 0, settingsReleased: false,
    orderGate: undefined as Promise<void> | undefined, orders: 0, paymentCreates: 0, paymentMode: "MANUAL" as "MANUAL" | "DOKU" };
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status === 200, data }) });
    if (request.method() !== "GET") state.mutations += 1;
    if (path.endsWith("/location/stores")) {
      state.listReads += 1;
      if (state.listError) return json(null, 503);
      return json(state.stores);
    }
    const location = stores.find((store) => path.endsWith(`/${store.location_code}/store`));
    if (location) {
      state.catalogs.push(location.location_code);
      const suffix = location.id === "store-a" ? "a" : "b";
      return json({
        location_id: location.id, location_code: location.location_code, location_name: location.location_name,
        total_stock: 10, time_open_store: "08:00", time_close_store: "20:00", time_start_pickup: "09:00", time_end_pickup: "19:00",
        product_stores: [{ id: `stock-${suffix}`, stock: 10, base_price: 25000, final_price: 25000, discount_price: 0, tax_percentage: 0, master_product: { id: `product-${suffix}`, product_name: `Produk ${location.location_name}`, product_code: `SKU-${suffix}`, image_url: "", category: "Frozen Food" } }],
      });
    }
    if (path.endsWith("/operational-status")) return json({ is_open: true, is_within_pickup_window: true, current_time: "10:00", store_open_time: "08:00", store_close_time: "20:00", pickup_start_time: "09:00", pickup_end_time: "19:00" });
    if (path.endsWith("/payment-settings")) {
      if (state.settingsGate) { state.settingsWaits += 1; await state.settingsGate; state.settingsReleased = true; }
      return json({ location_id: "store-a", payment_mode: state.paymentMode, doku_available: true, doku_methods: ["QRIS"] });
    }
    if (path.endsWith("/check-customer-by-no-wa")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, exists: false }) });
    if (path.endsWith("/transactions") && request.method() === "POST") {
      state.orders += 1;
      if (state.orderGate) await state.orderGate;
      return json({ id: "existing-order", transaction_code: "TRX-EXISTING", master_location_id: "store-a", status: "WAITING_TO_PAYMENT", payment_provider: state.paymentMode, total_amount: 25000, total_item: 1, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), transaction_carts: [] });
    }
    if (path.endsWith("/payments/checkout")) { state.paymentCreates += 1; return json(null, 503); }
    if (path.endsWith("/payment-methods")) return json([{ id: "bank", payment_type: "transfer_rekening", is_active: true, bank_name: "BCA", account_number: "123" }]);
    if (path.endsWith("/transactions/existing-order")) return json({ id: "existing-order", transaction_code: "TRX-EXISTING", master_location_id: "store-a", status: "WAITING_TO_PAYMENT", payment_provider: "MANUAL", total_amount: 25000, total_item: 1, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), transaction_carts: [] });
    return json([]);
  });
  await context.addInitScript(({ initial, confirmedKey, cartKey, cart }) => {
    if (sessionStorage.getItem("test.location-initialized")) return;
    sessionStorage.setItem("test.location-initialized", "1");
    if (initial.saved) localStorage.setItem("selectedLocationCode", initial.saved);
    if (initial.confirmed) sessionStorage.setItem(confirmedKey, initial.confirmed);
    if (initial.cart) localStorage.setItem(cartKey, JSON.stringify(cart));
  }, { initial, confirmedKey, cartKey, cart });
  return state;
}

for (const width of [1440, 768, 390]) {
  test(`active location must be confirmed before browsing at ${width}px`, async ({ context, page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = await fixtures(context);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/commerce");
    await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Farm Benda/ })).toBeChecked();
    await expect(page.getByRole("radio")).toHaveCount(2);
    await expect(page.getByText("Lokasi Nonaktif")).toHaveCount(0);
    expect(state.catalogs).toEqual([]);
    expect(state.mutations).toBe(0);
    await page.getByRole("radio", { name: /Wisma Argo Manunggal/ }).check();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`location-selector-${width}.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
    await expect(page).toHaveURL(/\/OUTLET-B\/commerce$/);
    await expect(page.getByText("Produk Wisma Argo Manunggal", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ganti lokasi", exact: true })).toBeVisible();
    expect(state.catalogs.every((code) => code === "OUTLET-B")).toBe(true);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), confirmedKey)).toBe("OUTLET-B");
    await page.reload();
    await expect(page.getByText("Produk Wisma Argo Manunggal", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("saved preference and a single active location still require explicit selection", async ({ context, page }) => {
  const state = await fixtures(context, { saved: "OUTLET-B" });
  state.stores = [stores[1], stores[2]];
  await page.goto("/OUTLET-B/commerce/cart");
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Wisma Argo Manunggal/ })).toBeChecked();
  expect(state.catalogs).toEqual([]);
  await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page).toHaveURL(/\/OUTLET-B\/commerce\/cart$/);
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toHaveCount(0);
});

test("a foreign cart link prompts again and choosing the original store preserves its cart", async ({ context, page }) => {
  const state = await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A", cart: true });
  await page.goto("/OUTLET-B/commerce/cart");
  await expect(page.getByRole("radio", { name: /Wisma Argo Manunggal/ })).toBeChecked();
  await expect(page.getByRole("alert")).toContainText(/mengosongkan keranjang/i);
  expect(state.catalogs).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual(cart);
  await page.getByRole("radio", { name: /Farm Benda/ }).check();
  await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page).toHaveURL(/\/OUTLET-A\/commerce$/);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual(cart);
});

test("switching stores clears only the cart after explicit confirmation", async ({ context, page }) => {
  await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A", cart: true });
  await page.goto("/OUTLET-A/commerce");
  await expect(page.getByText("Produk Farm Benda", { exact: true }).first()).toBeVisible();
  await context.addCookies([{ name: "test_order_capability", value: "fixture-only", domain: "127.0.0.1", path: "/", httpOnly: true }]);
  await page.evaluate(() => localStorage.setItem("argopos.store.pending-payments.v1", JSON.stringify({ version: 1, items: [{ transaction_id: "existing-order", transaction_code: "TRX-EXISTING", location_code: "OUTLET-A", location_name: "Farm Benda", total_amount: 25000, status: "WAITING_TO_PAYMENT", created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString() }] })));
  await page.getByRole("link", { name: "Ganti lokasi", exact: true }).click();
  await page.getByRole("radio", { name: /Wisma Argo Manunggal/ }).check();
  await expect(page.getByRole("alert")).toContainText(/mengosongkan keranjang/i);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual(cart);
  await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page).toHaveURL(/\/OUTLET-B\/commerce$/);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("selectedLocationCode"))).toBe("OUTLET-B");
  expect((await context.cookies()).some(cookie => cookie.name === "test_order_capability")).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.pending-payments.v1") || "{}").items?.some((item: { transaction_id: string }) => item.transaction_id === "existing-order"))).toBe(true);
});

test("confirmation rechecks active locations instead of falling back silently", async ({ context, page }) => {
  const state = await fixtures(context);
  await page.goto("/commerce");
  await expect(page.getByRole("radio", { name: /Farm Benda/ })).toBeChecked();
  state.stores = [stores[1]];
  await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(state.catalogs).toEqual([]);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), confirmedKey)).toBeNull();
  await page.getByRole("radio", { name: /Wisma Argo Manunggal/ }).check();
  await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page).toHaveURL(/\/OUTLET-B\/commerce$/);
});

test("unavailable and empty location lists block entry without changing the cart", async ({ context, page }) => {
  const state = await fixtures(context, { saved: "OUTLET-A", cart: true });
  state.listError = true;
  await page.goto("/commerce");
  await expect(page.getByRole("alert")).toBeVisible();
  expect(state.catalogs).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual(cart);
  state.listError = false;
  state.stores = [];
  await page.getByRole("button", { name: /Coba lagi|Muat ulang/i }).click();
  await expect(page.getByText(/Belum ada lokasi aktif/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Lanjutkan belanja", exact: true })).toHaveCount(0);
  expect(state.catalogs).toEqual([]);
});

test("another tab changing the cart owner blocks the original shopping tab", async ({ context, page }) => {
  await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A", cart: true });
  await page.goto("/OUTLET-A/commerce");
  await expect(page.getByText("Produk Farm Benda", { exact: true }).first()).toBeVisible();
  const other = await context.newPage();
  await other.goto("/OUTLET-B/commerce");
  await other.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(other).toHaveURL(/\/OUTLET-B\/commerce$/);
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
  await expect(page.getByText("Produk Farm Benda", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("selectedLocationCode"))).toBe("OUTLET-B");
});

test("existing payment links stay accessible without selecting a shopping location", async ({ context, page }) => {
  const state = await fixtures(context);
  await page.goto("/OUTLET-A/commerce/payment/existing-order");
  await expect(page.getByRole("heading", { name: "Detail pembayaran", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toHaveCount(0);
  expect(state.listReads).toBe(0);
  expect(state.mutations).toBe(0);
});

test("checkout awaiting settings cannot create an old-store order after switching location", async ({ context, page }) => {
  const state = await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A", cart: true });
  await page.goto("/OUTLET-A/commerce/cart");
  await page.getByLabel("Nomor WhatsApp", { exact: true }).fill("628123456789");
  await page.getByLabel("Nama pelanggan").fill("Customer Fixture");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByText("Transfer Rekening", { exact: true }).click();
  let release!: () => void;
  state.settingsGate = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await expect.poll(() => state.settingsWaits).toBe(1);
  const other = await context.newPage();
  await other.goto("/OUTLET-B/commerce");
  await other.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
  release();
  await expect.poll(() => state.settingsReleased).toBe(true);
  await page.waitForTimeout(600);
  expect(state.orders).toBe(0);
});

test("committed checkout preserves its recovery without clearing a new location cart", async ({ context, page }) => {
  const state = await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A", cart: true });
  state.paymentMode = "DOKU";
  await page.goto("/OUTLET-A/commerce/cart");
  await page.getByLabel("Nomor WhatsApp", { exact: true }).fill("628123456789");
  await page.getByLabel("Nama pelanggan").fill("Customer Fixture");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  let release!: () => void;
  state.orderGate = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await page.getByRole("radio", { name: "QRIS", exact: true }).check();
  await page.getByRole("button", { name: "Konfirmasi dan bayar", exact: true }).click();
  await expect.poll(() => state.orders).toBe(1);
  const other = await context.newPage();
  await other.goto("/OUTLET-B/commerce");
  await other.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(other.getByText("Produk Wisma Argo Manunggal", { exact: true }).first()).toBeVisible();
  const newCart = [{ ...cart[0], productId: "stock-b", productStockId: "stock-b", productName: "Produk Wisma Argo Manunggal" }];
  await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: cartKey, value: newCart });
  release();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.pending-payments.v1") || "{}").items?.some((item: { transaction_id: string }) => item.transaction_id === "existing-order"))).toBe(true);
  await page.waitForTimeout(600);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual(newCart);
  expect(state.orders).toBe(1);
  expect(state.paymentCreates).toBe(0);
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
});

test("delayed product add cannot put old-store stock into another location cart", async ({ context, page }) => {
  await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A" });
  await page.goto("/OUTLET-A/commerce/product/stock-a");
  const other = await context.newPage();
  await other.goto("/OUTLET-A/commerce");
  await expect(other.getByText("Produk Farm Benda", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Tambah.*keranjang/i }).click();
  await other.evaluate(() => {
    localStorage.setItem("selectedLocationCode", "OUTLET-B");
    localStorage.setItem("argopos.store.cart", "[]");
  });
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
  await page.waitForTimeout(650);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual([]);
});

test("a failed shared location write preserves the original cart and blocks entry", async ({ context, page }) => {
  await fixtures(context, { saved: "OUTLET-A", confirmed: "OUTLET-A", cart: true });
  await page.goto("/commerce/locations");
  await page.getByRole("radio", { name: /Wisma Argo Manunggal/ }).check();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "selectedLocationCode") throw new DOMException("Quota exceeded", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Lanjutkan belanja", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /disimpan|penyimpanan/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pilih lokasi belanja" })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), cartKey)).toEqual(cart);
  expect(await page.evaluate(() => localStorage.getItem("selectedLocationCode"))).toBe("OUTLET-A");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), confirmedKey)).toBe("OUTLET-A");
});
