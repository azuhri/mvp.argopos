import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type CheckoutOutcome = "uncertain" | "rejected" | "network-error";

async function mockCheckout(context: BrowserContext, page: Page, options: { unavailable?: boolean; settingsError?: boolean; outcome?: CheckoutOutcome; methods?: string[]; outsidePickup?: boolean } = {}) {
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const state = { mode: "DOKU", orderCreates: 0, paymentCreates: 0, settingsError: options.settingsError || false, methods: options.methods ?? ["QRIS"], chosenMethod: "", settingsGate: undefined as Promise<void> | undefined };
  const order = { id: "mode-order", transaction_code: "TRX-MODE-ORDER", master_location_id: "mode-store", payment_provider: "DOKU", status: "WAITING_TO_PAYMENT", base_amount: 50000, total_amount: 50000, total_item: 1, created_at: new Date().toISOString(), expires_at: expiresAt, transaction_carts: [] };
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (path.endsWith("/MODE-STORE/store")) return json({ location_id: "mode-store", location_code: "MODE-STORE", location_name: "Outlet Mode", total_stock: 4, product_stores: [{ id: "mode-stock", stock: 4, base_price: 50000, final_price: 50000, master_product: { id: "mode-product", product_name: "Produk Mode", image_url: "" } }] });
    if (path.endsWith("/payment-settings")) {
      if (state.settingsGate) await state.settingsGate;
      if (state.settingsError) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false }) });
      return json({ location_id: "mode-store", payment_mode: state.mode, doku_available: !options.unavailable, doku_methods: state.methods });
    }
    if (path.endsWith("/payment-methods")) return json([{ id: "manual-one", payment_type: "transfer_rekening", is_active: true, bank_name: "Bank Test", account_number: "123" }]);
    if (path.endsWith("/assigned-users")) return json([]);
    if (path.endsWith("/operational-status")) return json({ is_open: true, current_time: "14:00", is_within_pickup_window: !options.outsidePickup, pickup_start_time: "09:00", pickup_end_time: "12:00" });
    if (path.endsWith("/check-customer-by-no-wa")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, exists: false }) });
    if (path.endsWith("/transactions") && request.method() === "POST") {
      state.orderCreates += 1;
      state.chosenMethod = request.postDataJSON().doku_payment_method;
      expect(state.methods).toContain(state.chosenMethod);
      return json({ ...order, doku_payment_method: state.chosenMethod });
    }
    const session = { payment_id: "mode-attempt", transaction_id: order.id, invoice_number: "CEL-MODE", amount: 50000, expires_at: expiresAt, status: options.outcome === "rejected" ? "FAILED" : "PENDING", creation_state: options.outcome === "rejected" ? "REJECTED" : "UNCERTAIN", verification_pending: options.outcome !== "rejected", doku_payment_method: state.chosenMethod };
    if (path.endsWith("/payments/checkout")) {
      state.paymentCreates += 1;
      expect(request.postDataJSON()).toEqual({ transaction_id: order.id });
      const storage = await page.evaluate(() => ({ cart: JSON.parse(localStorage.getItem("argopos.store.cart") || "[]"), pending: JSON.parse(localStorage.getItem("argopos.store.pending-payments.v1") || "null") }));
      expect(storage.cart).toEqual([]);
      expect(storage.pending.items[0].transaction_id).toBe(order.id);
      if (options.outcome === "network-error") return route.abort("failed");
      return json(session, options.outcome === "rejected" ? 200 : 202);
    }
    if (path.endsWith("/payments/transactions/mode-order")) return json(session);
    if (path.endsWith("/transactions/mode-order")) return json(order);
    return json([]);
  });
  await context.addInitScript(() => {
    if (sessionStorage.getItem("test.mode-cart-initialized")) return;
    sessionStorage.setItem("test.mode-cart-initialized", "1");
    localStorage.setItem("selectedLocationCode", "MODE-STORE");
    localStorage.setItem("argopos.store.cart", JSON.stringify([{ productId: "mode-stock", productStockId: "mode-stock", qty: 1, productName: "Produk Mode", productPrice: 50000, productStock: 4, productImageUrl: "", tax_percentage: 0 }]));
  });
  return state;
}

async function fillCustomer(page: Page) {
  await page.getByLabel("Nomor WhatsApp").fill("628123456789");
  await page.getByLabel("Nama pelanggan").fill("Pelanggan Mode");
  await page.getByLabel("Email", { exact: true }).fill("mode@example.test");
}

test("DOKU unavailable keeps manual methods hidden and prevents new orders", async ({ context, page }) => {
  const state = await mockCheckout(context, page, { unavailable: true });
  await page.goto("/MODE-STORE/commerce/cart");
  await expect(page.getByText("DOKU — pembayaran online", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Pembayaran DOKU sementara tidak tersedia");
  await expect(page.getByText("Transfer Rekening", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true })).toBeDisabled();
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("unreadable settings block checkout without falling back to manual", async ({ context, page }) => {
  const state = await mockCheckout(context, page, { settingsError: true });
  await page.goto("/MODE-STORE/commerce/cart");
  await expect(page.getByRole("alert")).toContainText("Pengaturan pembayaran outlet belum dapat dimuat");
  await expect(page.getByText("Transfer Rekening", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true })).toBeDisabled();
  state.settingsError = false;
  await page.getByRole("button", { name: "Muat ulang pembayaran" }).click();
  await expect(page.getByText("DOKU — pembayaran online", { exact: true })).toBeVisible();
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("a mode change before submission refreshes options without creating an order", async ({ context, page }) => {
  const state = await mockCheckout(context, page);
  await page.goto("/MODE-STORE/commerce/cart");
  await expect(page.getByText("DOKU — pembayaran online", { exact: true })).toBeVisible();
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await page.getByRole("radio", { name: "QRIS", exact: true }).click();
  state.mode = "MANUAL";
  await page.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
  await expect(page.getByText("Transfer Rekening", { exact: true })).toBeVisible();
  await expect(page.getByText("DOKU — pembayaran online", { exact: true })).toHaveCount(0);
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("a DOKU store with no configured methods cannot create an order", async ({ context, page }) => {
  const state = await mockCheckout(context, page, { methods: [] });
  await page.goto("/MODE-STORE/commerce/cart");
  await expect(page.getByRole("alert")).toContainText("Belum ada metode DOKU yang tersedia");
  await expect(page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true })).toBeDisabled();
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("a single allowed method still requires selection and cancelling preserves the cart", async ({ context, page }) => {
  const state = await mockCheckout(context, page, { methods: ["VIRTUAL_ACCOUNT_BCA"] });
  await page.goto("/MODE-STORE/commerce/cart");
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Pilih metode pembayaran DOKU" });
  await expect(dialog.getByRole("radio")).toHaveCount(1);
  await expect(dialog.getByRole("radio", { name: "Virtual Account BCA" })).not.toBeChecked();
  await expect(dialog.getByRole("radio", { name: "QRIS", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeDisabled();
  await dialog.getByRole("radio", { name: "Virtual Account BCA" }).click();
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.cart") || "[]").length)).toBe(1);
  await page.getByRole("button", { name: "Kembali belanja", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce$/);
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("a removed method is rejected before order creation and requires a new selection", async ({ context, page }) => {
  const state = await mockCheckout(context, page);
  await page.goto("/MODE-STORE/commerce/cart");
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Pilih metode pembayaran DOKU" });
  await dialog.getByRole("radio", { name: "QRIS", exact: true }).click();
  state.methods = ["VIRTUAL_ACCOUNT_BCA"];
  await dialog.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("sudah tidak tersedia");
  await expect(dialog.getByRole("radio", { name: "QRIS", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: "Virtual Account BCA" })).not.toBeChecked();
  await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeDisabled();
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("a settings error at confirmation blocks the selected method before creating an order", async ({ context, page }) => {
  const state = await mockCheckout(context, page);
  await page.goto("/MODE-STORE/commerce/cart");
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Pilih metode pembayaran DOKU" });
  await dialog.getByRole("radio", { name: "QRIS", exact: true }).click();
  state.settingsError = true;
  await dialog.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("belum tersedia");
  await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeDisabled();
  expect(state.orderCreates).toBe(0);
  expect(state.paymentCreates).toBe(0);
});

test("pickup acknowledgment still requires method confirmation and busy confirmation prevents changing or closing", async ({ context, page }) => {
  const state = await mockCheckout(context, page, { outsidePickup: true });
  await page.goto("/MODE-STORE/commerce/cart");
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Waktu pengambilan" })).toBeVisible();
  expect(state.orderCreates).toBe(0);
  await page.getByRole("button", { name: "Tetap Checkout", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Pilih metode pembayaran DOKU" });
  await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeDisabled();
  expect(state.orderCreates).toBe(0);
  await dialog.getByRole("radio", { name: "QRIS", exact: true }).click();
  let finishSettings!: () => void;
  state.settingsGate = new Promise<void>((resolve) => { finishSettings = resolve; });
  try {
    await dialog.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
    await expect(dialog.getByRole("button", { name: "Memproses..." })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Kembali ke keranjang" })).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: "QRIS", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(state.orderCreates).toBe(0);
    expect(state.paymentCreates).toBe(0);
  } finally {
    finishSettings();
  }
  await expect(page).toHaveURL(/\/MODE-STORE\/commerce\/payment\/mode-order$/);
  expect(state.orderCreates).toBe(1);
  expect(state.paymentCreates).toBe(1);
});

for (const outcome of ["uncertain", "rejected", "network-error"] as const) {
  test(`checkout ${outcome} recovers the confirmed order without creating another`, async ({ context, page }) => {
    const state = await mockCheckout(context, page, { outcome });
    await page.goto("/MODE-STORE/commerce/cart");
    await expect(page.getByText("DOKU — pembayaran online", { exact: true })).toBeVisible();
    await fillCustomer(page);
    expect(state.orderCreates).toBe(0);
    expect(state.paymentCreates).toBe(0);
    await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
    await page.getByRole("radio", { name: "QRIS", exact: true }).click();
    expect(state.orderCreates).toBe(0);
    expect(state.paymentCreates).toBe(0);
    await page.getByRole("button", { name: "Konfirmasi dan bayar" }).dblclick();
    await expect(page).toHaveURL(/\/MODE-STORE\/commerce\/payment\/mode-order$/);
    await expect(page.getByRole("heading", { name: outcome === "rejected" ? "Pembayaran belum berhasil" : "Menunggu verifikasi pembayaran" })).toBeVisible();
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(1);
    state.mode = "MANUAL";
    state.methods = ["VIRTUAL_ACCOUNT_BCA"];
    await page.reload();
    await expect(page.getByRole("heading", { name: outcome === "rejected" ? "Pembayaran belum berhasil" : "Menunggu verifikasi pembayaran" })).toBeVisible();
    await expect(page.getByText("Transfer Rekening", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Pembayaran DOKU", exact: true }).getByText("QRIS", { exact: true })).toBeVisible();
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(1);
  });
}
