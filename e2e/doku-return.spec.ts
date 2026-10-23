import { expect, test, type BrowserContext, type Route } from "@playwright/test";

test.use({ video: "off" });
test.setTimeout(60000);

interface ReturnState {
  status: string;
  review: boolean;
  refreshes: number;
  creates: number;
  invoiceRequests: number;
  refreshError?: number;
  ownershipError?: boolean;
  holdRefresh?: Promise<void>;
}

async function mockReturn(context: BrowserContext, state: ReturnState) {
  await context.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const send = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    const fail = (status: number) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: status === 401 ? "payment ownership could not be verified" : "payment verification unavailable" } }) });
    if (path.endsWith("/RETURN/store")) return send({ location_id: "return-store", location_code: "RETURN", location_name: "Farm Benda", product_stores: [] });
    if (path.endsWith("/payment-methods") || path.endsWith("/assigned-users")) return send([]);
    if (path.endsWith("/payment-settings")) return send({ payment_mode: "DOKU", doku_available: true, doku_methods: ["VIRTUAL_ACCOUNT_BCA"] });
    if (path.endsWith("/payments/checkout") || (path.endsWith("/transactions") && request.method() === "POST")) {
      state.creates++;
      return fail(500);
    }
    if (path.includes("/payments/transactions/return-order")) {
      if (state.ownershipError) return fail(401);
      if (path.endsWith("/invoice")) { state.invoiceRequests++; return fail(503); }
      if (path.endsWith("/refresh")) {
        expect(request.method()).toBe("POST");
        expect(request.postDataJSON()).toEqual({});
        state.refreshes++;
        if (state.holdRefresh) await state.holdRefresh;
        if (state.refreshError) return fail(state.refreshError);
      }
      return send({
        payment_id: "return-attempt", transaction_id: "return-order", invoice_number: "CEL-RETURN-TEST",
        status: state.status, creation_state: "READY", amount: 27900,
        checkout_url: "https://sandbox.doku.com/checkout/should-never-open-on-return",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(), verification_pending: state.status === "PENDING",
        review_required: state.review, doku_payment_method: "VIRTUAL_ACCOUNT_BCA",
      });
    }
    if (path.endsWith("/transactions/return-order")) return send({
      id: "return-order", transaction_code: "TRX-DOKU-RETURN-TEST", master_location_id: "return-store",
      payment_provider: "DOKU", status: state.status === "PAID" && !state.review ? "PAID" : "WAITING_TO_PAYMENT",
      base_amount: 27900, total_amount: 27900, total_item: 1, created_at: new Date().toISOString(),
      paid_at: state.status === "PAID" && !state.review ? new Date().toISOString() : null,
      transaction_carts: [{ id: "return-line", qty: 1, amount: 27900, product_details: { product_name: "Sosis Ayam Cocktail" } }],
    });
    return fail(404);
  });
}

const pending = (): ReturnState => ({ status: "PENDING", review: false, refreshes: 0, creates: 0, invoiceRequests: 0 });
const returnURL = "/RETURN/commerce/payment/return-order?doku_return=1&status=SUCCESS";

test("return polls every 5 seconds, recovers from a network failure, and stops after payment", async ({ page, context }) => {
  const state = pending();
  state.refreshError = 503;
  await mockReturn(context, state);
  await page.clock.install();
  await page.goto(returnURL);
  await expect.poll(() => state.refreshes).toBe(1);
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Bayar melalui DOKU|Lanjut.*DOKU/i })).toHaveCount(0);
  await page.clock.fastForward(4000);
  expect(state.refreshes).toBe(1);
  state.refreshError = undefined;
  await page.clock.fastForward(1000);
  await expect.poll(() => state.refreshes).toBe(2);
  await expect(page.getByRole("heading", { name: "Menunggu verifikasi pembayaran" })).toBeVisible();
  state.status = "PAID";
  await page.clock.fastForward(5000);
  await expect(page).toHaveURL(/\/commerce\/payment-success\/return-order$/);
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toBeVisible();
  await page.clock.fastForward(20000);
  expect(state.refreshes).toBe(3);
  expect(state.creates).toBe(0);
});

test("a slow in-flight check never overlaps or creates another checkout", async ({ page, context }) => {
  const state = pending();
  let release!: () => void;
  state.holdRefresh = new Promise<void>((resolve) => { release = resolve; });
  await mockReturn(context, state);
  await page.clock.install();
  await page.goto(returnURL);
  await expect.poll(() => state.refreshes).toBe(1);
  await page.clock.fastForward(10000);
  expect(state.refreshes).toBe(1);
  state.status = "PAID";
  release();
  await expect(page).toHaveURL(/\/commerce\/payment-success\/return-order$/);
  await page.clock.fastForward(15000);
  expect(state.refreshes).toBe(1);
  expect(state.creates).toBe(0);
});

test("reopening an order without the return query verifies payment automatically", async ({ page, context }) => {
  const state = pending();
  await mockReturn(context, state);
  await page.clock.install();
  await page.goto("/RETURN/commerce/payment/return-order");
  await expect.poll(() => state.refreshes).toBe(1);
  await expect(page.getByText(/Pembayaran diperiksa otomatis setiap 5 detik/)).toBeVisible();
  await page.clock.fastForward(5000);
  await expect.poll(() => state.refreshes).toBe(2);
  state.status = "PAID"; // A webhook has updated the stored status.
  await page.clock.fastForward(5000);
  await expect(page).toHaveURL(/\/commerce\/payment-success\/return-order$/);
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toBeVisible();
  await page.clock.fastForward(20000);
  expect(state.refreshes).toBe(2);
  expect(state.creates).toBe(0);
});

for (const terminal of ["FAILED", "EXPIRED"]) {
  test(`${terminal} return stops polling without showing success`, async ({ page, context }) => {
    const state = { ...pending(), status: terminal };
    await mockReturn(context, state);
    await page.clock.install();
    await page.goto(returnURL);
    await expect.poll(() => state.refreshes).toBe(1);
    await expect(page.getByRole("region", { name: "Pembayaran DOKU", exact: true })).toBeVisible();
    await page.clock.fastForward(20000);
    expect(state.refreshes).toBe(1);
    await expect(page).toHaveURL(/\/payment\/return-order\?/);
    await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Unduh invoice|Bayar melalui DOKU/i })).toHaveCount(0);
    expect(state.creates).toBe(0);
  });
}

test("a paid payment requiring review cannot enter success or download an invoice", async ({ page, context }) => {
  const state = { ...pending(), status: "PAID", review: true };
  await mockReturn(context, state);
  await page.clock.install();
  await page.goto("/RETURN/commerce/payment-success/return-order?status=SUCCESS");
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/payment\/return-order/);
  await expect(page.getByText(/sedang diperiksa admin|sedang memeriksa pembayaran/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Unduh invoice/i })).toHaveCount(0);
  await page.clock.fastForward(20000);
  expect(state.invoiceRequests).toBe(0);
  expect(state.creates).toBe(0);
});

test("lost ownership stops automatic requests and cannot display the success page", async ({ page, context }) => {
  const state = { ...pending(), status: "PAID", ownershipError: true };
  let ownedRequests = 0;
  page.on("request", (request) => { if (request.url().includes("/payments/transactions/return-order")) ownedRequests++; });
  await mockReturn(context, state);
  await page.clock.install();
  await page.goto(returnURL);
  await expect.poll(() => ownedRequests).toBe(1);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.clock.fastForward(20000);
  expect(ownedRequests).toBe(1);
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toHaveCount(0);
  await page.goto("/RETURN/commerce/payment-success/return-order?status=SUCCESS");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Unduh invoice/i })).toHaveCount(0);
  expect(state.invoiceRequests).toBe(0);
  expect(state.creates).toBe(0);
});

test("an invoice storage failure preserves the success page and allows retry", async ({ page, context }) => {
  const state = { ...pending(), status: "PAID" };
  await mockReturn(context, state);
  await page.goto("/RETURN/commerce/payment-success/return-order");
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toBeVisible();
  const button = page.getByRole("button", { name: /Unduh invoice/i });
  await button.click();
  await expect.poll(() => state.invoiceRequests).toBe(1);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => state.invoiceRequests).toBe(2);
  await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toBeVisible();
  expect(state.creates).toBe(0);
});
