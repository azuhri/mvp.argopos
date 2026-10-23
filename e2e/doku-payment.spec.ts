import { expect, test } from "@playwright/test";
import { recordTransactionCredentials, transactionCredentials } from "./payment-transport";

for (const width of [1440, 390]) {
  test(`DOKU checkout and verified return at ${width}px (mock provider)`, async ({ page, context }, testInfo) => {
    test.setTimeout(60000);
    await recordTransactionCredentials(context);
    await page.setViewportSize({ width, height: 950 });
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const store = {
      location_id: "location-doku", location_code: "DOKU-STORE", location_name: "AMP Mart Test", total_stock: 10,
      product_stores: [{ id: "stock-doku", stock: 10, base_price: 50000, final_price: 50000, tax_percentage: 0, master_product: { id: "product-doku", product_name: "Produk uji pembayaran", product_code: "TEST-01", image_path: "", image_url: "", category: "Makanan" } }],
    };
    const order = {
      id: "order-doku", transaction_code: "TRX-DOKU-TEST", master_location_id: store.location_id,
      payment_provider: "DOKU", status: "WAITING_TO_PAYMENT", base_amount: 50000, total_amount: 50000,
      total_item: 1, created_at: new Date().toISOString(), expires_at: expiresAt,
      transaction_carts: [{ id: "line-one", product_stock_id: "stock-doku", qty: 1, amount: 50000, product_details: { product_name: "Produk uji pembayaran" } }],
    };
    let orderCreates = 0;
    let paymentCreates = 0;
    let paymentStatus = "PENDING";
    let verificationPending = false;
    let providerPaid = false;
    let paymentChecks = 0;
    let selectedDokuMethod = "";
    const chosenMethod = width === 1440 ? "VIRTUAL_ACCOUNT_BCA" : "QRIS";
    const chosenMethodLabel = width === 1440 ? "Virtual Account BCA" : "QRIS";
    let storeMode = "DOKU";
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const respond = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
      if (path.endsWith("/DOKU-STORE/store")) return respond(store);
      if (path.endsWith("/payment-methods") || path.endsWith("/assigned-users")) return respond([]);
      if (path.endsWith("/payment-settings")) return respond({ location_id: store.location_id, payment_mode: storeMode, doku_available: true, doku_methods: ["QRIS", "VIRTUAL_ACCOUNT_BCA"] });
      if (path.endsWith("/location/stores/operational-status")) return respond({ is_open: true, current_time: "14:00", is_within_pickup_window: true });
      if (path.endsWith("/check-customer-by-no-wa")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, exists: false }) });
      if (path.endsWith("/transactions") && request.method() === "POST") {
        orderCreates += 1;
        const body = request.postDataJSON();
        expect(body.payment_provider).toBe("DOKU");
        expect(body.doku_payment_method).toBe(chosenMethod);
        selectedDokuMethod = body.doku_payment_method;
        expect(body).not.toHaveProperty("payment_method_id");
        expect(body).not.toHaveProperty("base_amount");
        expect(body).not.toHaveProperty("nominal_code");
        expect(body.carts).toEqual([{ product_stock_id: "stock-doku", qty: 1 }]);
        return respond({ ...order, doku_payment_method: selectedDokuMethod });
      }
      const session = { payment_id: paymentCreates ? "attempt-one" : "", transaction_id: order.id, invoice_number: paymentCreates ? "CEL-TEST-ONE" : "", status: paymentStatus, amount: 50000, expires_at: expiresAt, verification_pending: verificationPending, doku_payment_method: selectedDokuMethod };
      if (path.endsWith("/payments/transactions/order-doku")) return respond(session);
      if (path.endsWith("/payments/transactions/order-doku/refresh")) {
        paymentChecks += 1;
        expect(request.method()).toBe("POST");
        expect(request.postDataJSON()).toEqual({});
        if (providerPaid) { paymentStatus = "PAID"; verificationPending = false; }
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { ...session, status: paymentStatus, verification_pending: verificationPending }, meta: { checked: true } }) });
      }
      if (path.endsWith("/payments/checkout")) {
        paymentCreates += 1;
        expect(request.headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
        const recovery = await page.evaluate(() => ({ cart: JSON.parse(localStorage.getItem("argopos.store.cart") || "[]"), pending: JSON.parse(localStorage.getItem("argopos.store.pending-payments.v1") || "null") }));
        expect(recovery.cart).toEqual([]);
        expect(recovery.pending.items[0].transaction_id).toBe(order.id);
        return respond({ ...session, payment_id: "attempt-one", checkout_url: "https://sandbox.doku.com/checkout/test-only" });
      }
      if (path.endsWith("/transactions/order-doku")) return respond({ ...order, status: paymentStatus === "PAID" ? "PAID" : "WAITING_TO_PAYMENT" });
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });
    await context.route("https://sandbox.doku.com/checkout/test-only", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Hosted checkout test fixture</h1>" }));
    await context.addInitScript(() => {
      if (sessionStorage.getItem("test.cart-initialized")) return;
      sessionStorage.setItem("test.cart-initialized", "1");
      localStorage.setItem("selectedLocationCode", "DOKU-STORE");
      localStorage.setItem("argopos.store.cart", JSON.stringify([{ productId: "stock-doku", productStockId: "stock-doku", qty: 1, productName: "Produk uji pembayaran", productPrice: 50000, productStock: 10, productImageUrl: "", tax_percentage: 0 }]));
    });
    await page.goto("/DOKU-STORE/commerce/cart");
    await expect(page.getByText("DOKU — pembayaran online", { exact: true })).toBeVisible();
    await expect(page.getByText("Transfer Rekening", { exact: true })).toHaveCount(0);
    expect(orderCreates).toBe(0);
    expect(paymentCreates).toBe(0);
    await page.getByLabel("Nomor WhatsApp").fill("628123456789");
    await page.getByLabel("Nama pelanggan").fill("Pelanggan Uji");
    await page.getByLabel("Email", { exact: true }).fill("customer@example.test");
    await page.getByText("DOKU — pembayaran online", { exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`doku-cart-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Pilih metode pembayaran DOKU" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`doku-method-unselected-${width}.png`), animations: "disabled" });
    await dialog.getByRole("radio", { name: chosenMethodLabel, exact: true }).click();
    expect(orderCreates).toBe(0);
    expect(paymentCreates).toBe(0);
    await dialog.getByRole("button", { name: "Kembali ke keranjang" }).click();
    await expect(dialog).toHaveCount(0);
    expect(orderCreates).toBe(0);
    await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeDisabled();
    await dialog.getByRole("radio", { name: chosenMethodLabel, exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Konfirmasi dan bayar" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`doku-method-choice-${width}.png`), animations: "disabled" });
    const confirmAppearance = await dialog.getByRole("button", { name: "Konfirmasi dan bayar" }).evaluate((element: HTMLButtonElement) => ({ disabled: element.disabled, background: getComputedStyle(element).backgroundColor, opacity: getComputedStyle(element).opacity }));
    await testInfo.attach(`doku-confirm-appearance-${width}`, { contentType: "application/json", body: JSON.stringify(confirmAppearance) });
    expect(orderCreates).toBe(0);
    expect(paymentCreates).toBe(0);
    await dialog.getByRole("button", { name: "Konfirmasi dan bayar" }).dblclick();
    await expect(page).toHaveURL("https://sandbox.doku.com/checkout/test-only");
    expect(orderCreates).toBe(1);
    expect(paymentCreates).toBe(1);
    verificationPending = true;
    storeMode = "MANUAL";
    await page.goto("http://127.0.0.1:4173/DOKU-STORE/commerce/payment/order-doku?doku_return=1&status=SUCCESS");
    await expect(page.getByRole("heading", { name: "Menunggu verifikasi pembayaran" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pembayaran DOKU", exact: true }).getByText(chosenMethodLabel, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toHaveCount(0);
    await expect(page.getByText("Kode unik", { exact: true })).toHaveCount(0);
    const credentialRequests = await transactionCredentials(page);
    expect(credentialRequests.find((request) => request.path.endsWith("/transactions") && request.method === "POST")?.credentials).toBe("include");
    expect(credentialRequests.some((request) => request.path.endsWith("/payments/config"))).toBe(false);
    expect(credentialRequests.find((request) => request.path.endsWith("/payments/checkout"))?.credentials).toBe("include");
    expect(credentialRequests.find((request) => request.path.endsWith("/payments/transactions/order-doku"))?.credentials).toBe("include");
    expect(credentialRequests.find((request) => request.path.endsWith("/transactions/order-doku") && !request.path.includes("/payments/"))?.credentials).toBe("same-origin");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`doku-pending-${width}.png`), fullPage: true });
    expect(paymentChecks).toBe(0);
    providerPaid = true;
    await page.getByRole("button", { name: "Periksa status pembayaran" }).click();
    await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toBeVisible();
    await expect(page.getByText("Waiting Payment", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Paid", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Pembayaran DOKU telah diterima. Periksa detail verifikasi di bawah.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bayar melalui DOKU" })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`doku-verified-${width}.png`), fullPage: true });
    expect((await transactionCredentials(page)).find((request) => request.path.endsWith("/payments/transactions/order-doku/refresh"))?.credentials).toBe("include");
    expect(paymentChecks).toBe(1);
    expect(orderCreates).toBe(1);
    expect(paymentCreates).toBe(1);
  });
}
