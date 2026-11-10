import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type CheckoutOutcome = "uncertain" | "rejected" | "network-error" | "http-error";

async function mockCheckout(context: BrowserContext, page: Page, options: { unavailable?: boolean; settingsError?: boolean; outcome?: CheckoutOutcome; methods?: string[]; outsidePickup?: boolean; replayable?: boolean; retryOutcome?: "ready" | "response-lost" | "request-lost" } = {}) {
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const state = { mode: "DOKU", orderCreates: 0, paymentCreates: 0, refreshes: 0, paymentKeys: [] as string[], checkoutReady: false, settingsError: options.settingsError || false, methods: options.methods ?? ["QRIS"], chosenMethod: "", settingsGate: undefined as Promise<void> | undefined };
  const order = { id: "mode-order", transaction_code: "TRX-MODE-ORDER", master_location_id: "mode-store", payment_provider: "DOKU", status: "WAITING_TO_PAYMENT", base_amount: 50000, total_amount: 50000, total_item: 1, created_at: new Date().toISOString(), expires_at: expiresAt, transaction_carts: [] };
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (path.endsWith("/location/stores")) return json([{ id: "mode-store", location_code: "MODE-STORE", location_name: "Outlet Mode", type: "store", status: "active" }]);
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
    const session = () => state.checkoutReady
      ? { payment_id: "mode-replacement", transaction_id: order.id, invoice_number: "CEL-REPLACEMENT", amount: 50000, expires_at: expiresAt, status: "PENDING", transaction_status: "WAITING_TO_PAYMENT", creation_state: "READY", verification_pending: false, can_retry_checkout: false, doku_payment_method: state.chosenMethod, checkout_url: "https://sandbox.doku.com/checkout/recovered-order" }
      : { payment_id: "mode-attempt", transaction_id: order.id, invoice_number: "CEL-MODE", amount: 50000, expires_at: options.outcome === "rejected" ? new Date(Date.now() - 1000).toISOString() : expiresAt, transaction_status: "FAILED", status: options.outcome === "rejected" ? "FAILED" : "PENDING", creation_state: options.outcome === "rejected" ? "REJECTED" : "UNCERTAIN", verification_pending: options.outcome !== "rejected", can_retry_checkout: options.outcome === "rejected", can_resume_checkout: options.replayable === true, checkout_retry_expires_at: expiresAt, doku_payment_method: state.chosenMethod };
    if (path.endsWith("/payments/checkout")) {
      state.paymentCreates += 1;
      state.paymentKeys.push(request.headers()["idempotency-key"]);
      expect(request.postDataJSON()).toEqual({ transaction_id: order.id });
      if (state.paymentCreates === 1) {
        const storage = await page.evaluate(() => ({ cart: JSON.parse(localStorage.getItem("argopos.store.cart") || "[]"), pending: JSON.parse(localStorage.getItem("argopos.store.pending-payments.v1") || "null") }));
        expect(storage.cart).toEqual([]);
        expect(storage.pending.items[0].transaction_id).toBe(order.id);
      }
      if (options.retryOutcome && state.paymentCreates > 1) {
        state.checkoutReady = !(options.retryOutcome === "request-lost" && state.paymentCreates === 2);
        if (options.retryOutcome !== "ready" && state.paymentCreates === 2) return route.abort("failed");
        return json(session());
      }
      if (options.outcome === "network-error") return route.abort("failed");
      if (options.outcome === "http-error") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "gateway unavailable" } }) });
      return json(session(), options.outcome === "rejected" ? 200 : 202);
    }
    if (path.endsWith("/payments/transactions/mode-order/refresh")) {
      state.refreshes += 1;
      // Mirror the real recent-attempt age guard: a provider check can be
      // deferred even when GET already has the persisted hosted checkout URL.
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: state.checkoutReady ? { ...session(), verification_pending: true } : session(), meta: { checked: false } }) });
    }
    if (path.endsWith("/payments/transactions/mode-order")) return json(session());
    if (path.endsWith("/transactions/mode-order")) return json({ ...order, status: state.checkoutReady ? "WAITING_TO_PAYMENT" : "FAILED" });
    return json([]);
  });
  await context.route("https://sandbox.doku.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Hosted checkout fixture</h1>" }));
  await context.addInitScript(() => {
    if (sessionStorage.getItem("test.mode-cart-initialized")) return;
    sessionStorage.setItem("test.mode-cart-initialized", "1");
    localStorage.setItem("selectedLocationCode", "MODE-STORE");
    sessionStorage.setItem("argopos.commerce.location-confirmed.v1", "MODE-STORE");
    localStorage.setItem("argopos.store.cart", JSON.stringify([{ productId: "mode-stock", productStockId: "mode-stock", qty: 1, productName: "Produk Mode", productPrice: 50000, productStock: 4, productImageUrl: "", tax_percentage: 0 }]));
  });
  return state;
}

async function fillCustomer(page: Page) {
  await page.getByLabel("Nomor WhatsApp").fill("628123456789");
  await page.getByLabel("Nama pelanggan").fill("Pelanggan Mode");
  await page.getByLabel("Email", { exact: true }).fill("mode@example.test");
}

for (const width of [390, 1440]) {
  test(`maintenance explicitly recovers an uncertain checkout at ${width}px`, async ({ context, page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    const state = await mockCheckout(context, page, { outcome: "uncertain", methods: ["VIRTUAL_ACCOUNT_BCA"], replayable: true, retryOutcome: "ready" });
    await page.goto("/MODE-STORE/commerce/cart");
    await fillCustomer(page);
    await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
    await page.getByRole("radio", { name: "Virtual Account BCA", exact: true }).click();
    await page.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
    await expect(page).toHaveURL(/\/payment-maintenance\/mode-order$/);
    await expect(page.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled();
    expect(state.paymentCreates).toBe(1);
    await page.reload();
    await expect(page.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled();
    expect(state.paymentCreates).toBe(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`maintenance-reapply-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Ajukan ulang pembayaran" }).dblclick();
    await expect(page).toHaveURL("https://sandbox.doku.com/checkout/recovered-order");
    await expect(page.getByRole("heading", { name: "Hosted checkout fixture" })).toBeVisible();
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(2);
    expect(errors).toEqual([]);
  });
}

test("failed reapplication stays on maintenance without navigating to waiting payment", async ({ context, page }) => {
  const state = await mockCheckout(context, page, { outcome: "uncertain", methods: ["VIRTUAL_ACCOUNT_BCA"], replayable: true });
  await page.goto("/MODE-STORE/commerce/cart");
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await page.getByRole("radio", { name: "Virtual Account BCA", exact: true }).click();
  await page.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
  await expect(page).toHaveURL(/\/payment-maintenance\/mode-order$/);
  await page.getByRole("button", { name: "Ajukan ulang pembayaran" }).click();
  await expect(page.getByText("Pembayaran belum berhasil disiapkan. Silakan ajukan ulang beberapa saat lagi.")).toBeVisible();
  await expect(page).toHaveURL(/\/payment-maintenance\/mode-order$/);
  await expect(page.getByText("Waiting Payment", { exact: true })).toHaveCount(0);
  expect(state.orderCreates).toBe(1);
  expect(state.paymentCreates).toBe(2);
});

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
  await expect(page).toHaveURL(/\/MODE-STORE\/commerce\/payment-maintenance\/mode-order$/);
  expect(state.orderCreates).toBe(1);
  expect(state.paymentCreates).toBe(1);
});

for (const outcome of ["uncertain", "rejected", "network-error", "http-error"] as const) {
  test(`checkout ${outcome} recovers the confirmed order without creating another`, async ({ context, page }, testInfo) => {
    await page.setViewportSize({ width: outcome === "rejected" ? 1440 : outcome === "uncertain" ? 390 : 768, height: 950 });
    const state = await mockCheckout(context, page, { outcome });
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
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
    await expect(page).toHaveURL(/\/MODE-STORE\/commerce\/payment-maintenance\/mode-order$/);
    await expect(page.getByRole("heading", { name: "Pembayaran sedang maintenance" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Informasi layanan pembayaran", exact: true }).getByRole("alert")).toHaveText("Mohon maaf, kami sedang melakukan maintanance. Untuk sementara system pembarayan, belum bisa diguanakan. Cobalah beberapa saat lagi");
    await expect(page.getByText("Waiting Payment", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Detail pembayaran" })).toHaveCount(0);
    await expect(page.getByText("Ringkasan transaksi", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Produk pesanan", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Total pembayaran", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("payment-countdown")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`maintenance-${outcome}.png`), fullPage: true });
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(1);
    state.mode = "MANUAL";
    state.methods = ["VIRTUAL_ACCOUNT_BCA"];
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pembayaran sedang maintenance" })).toBeVisible();
    await expect(page.getByText("Transfer Rekening", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Kembali ke katalog", exact: true })).toHaveAttribute("href", "/MODE-STORE/commerce");
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(1);
    expect(pageErrors).toEqual([]);
  });
}

test("order creation HTTP 503 opens maintenance without a fabricated payment or clearing the cart", async ({ context, page }) => {
  const state = await mockCheckout(context, page);
  await page.route("**/api/v1/transactions", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "gateway unavailable" } }) }));
  await page.goto("/MODE-STORE/commerce/cart");
  await fillCustomer(page);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await page.getByRole("radio", { name: "QRIS", exact: true }).click();
  await page.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
  await expect(page).toHaveURL(/\/commerce\/payment-maintenance$/);
  await expect(page.getByRole("heading", { name: "Pembayaran sedang maintenance" })).toBeVisible();
  await expect(page.getByText("Waiting Payment", { exact: true })).toHaveCount(0);
  expect(state.paymentCreates).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.cart") || "[]"))).toHaveLength(1);
});

for (const retryOutcome of ["ready", "response-lost", "request-lost"] as const) {
  test(`retries checkout on the original order and recovers ${retryOutcome}`, async ({ context, page }, testInfo) => {
    const width = retryOutcome === "response-lost" ? 390 : retryOutcome === "request-lost" ? 768 : 1440;
    await page.setViewportSize({ width, height: 900 });
    const state = await mockCheckout(context, page, { outcome: "rejected", retryOutcome });
    await page.goto("/MODE-STORE/commerce/cart");
    await fillCustomer(page);
    await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
    await page.getByRole("radio", { name: "QRIS", exact: true }).click();
    await page.getByRole("button", { name: "Konfirmasi dan bayar" }).click();
    await expect(page).toHaveURL(/\/commerce\/payment-maintenance\/mode-order$/);
    await expect(page.getByRole("heading", { name: "Pembayaran sedang maintenance" })).toBeVisible();
    // A persisted return marker must not lock a definitively rejected creation.
    await page.goto("/MODE-STORE/commerce/payment/mode-order?doku_return=1");
    await expect(page.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`retry-checkout-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Ajukan ulang pembayaran" }).click();
    if (retryOutcome !== "ready") {
      await expect.poll(() => state.paymentCreates).toBe(2);
      await expect(page.getByRole("alert")).toContainText(retryOutcome === "response-lost" ? "Sesi pembayaran berhasil dipulihkan." : "Mohon maaf, kami sedang melakukan maintanance.");
      await page.reload();
      const action = retryOutcome === "response-lost" ? "Buka pembayaran DOKU" : "Ajukan ulang pembayaran";
      await expect(page.getByRole("button", { name: action })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`recover-checkout-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: action }).click();
    }
    await expect(page).toHaveURL("https://sandbox.doku.com/checkout/recovered-order");
    await expect(page.getByRole("heading", { name: "Hosted checkout fixture" })).toBeVisible();
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(retryOutcome === "request-lost" ? 3 : 2);
    expect(state.refreshes).toBe(0);
    expect(state.paymentKeys[1]).not.toBe(state.paymentKeys[0]);
    if (retryOutcome === "request-lost") expect(state.paymentKeys[2]).toBe(state.paymentKeys[1]);
    // Once the hosted page opened, a normal return is verification-only again.
    await page.goto("/MODE-STORE/commerce/payment/mode-order?doku_return=1");
    await expect(page.getByRole("heading", { name: "Menunggu verifikasi pembayaran" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Buka pembayaran DOKU|Lanjutkan ke DOKU|Ajukan ulang pembayaran/ })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem("argopos.checkout-recovery.mode-order"))).toBeNull();
    expect(state.orderCreates).toBe(1);
    expect(state.paymentCreates).toBe(retryOutcome === "request-lost" ? 3 : 2);
  });
}
