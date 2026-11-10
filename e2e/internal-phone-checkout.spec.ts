import { expect, test, type BrowserContext } from "@playwright/test";

async function setup(context: BrowserContext, provider: "MANUAL" | "DOKU") {
  const state = { validations: [] as string[], submissions: [] as Record<string, unknown>[], validationStatus: 200, validationGate: undefined as Promise<void> | undefined, rejectCheckout: false };
  const order = { id: "phone-order", transaction_code: "TRX-PHONE", master_location_id: "phone-store", payment_provider: provider, status: "WAITING_TO_PAYMENT", total_amount: 50000, total_item: 1, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), transaction_carts: [] };
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data }) });
    if (path.endsWith("/WAM/store")) return json({ location_id: "phone-store", location_code: "WAM", location_name: "WAM Test", product_stores: [{ id: "phone-stock", stock: 4, base_price: 50000, final_price: 50000, master_product: { id: "phone-product", product_name: "Produk Test", image_url: "/image/POKPOK%20PACKSHOT.png" } }] });
    if (path.endsWith("/payment-settings")) return json({ location_id: "phone-store", payment_mode: provider, doku_available: true, doku_methods: ["VIRTUAL_ACCOUNT_BCA"] });
    if (path.endsWith("/payment-methods")) return json([{ id: "manual-one", payment_type: "cutoff_hutang", is_active: true }]);
    if (path.endsWith("/assigned-users")) return json([]);
    if (path.endsWith("/operational-status")) return json({ is_open: true, current_time: "10:00", is_within_pickup_window: true });
    if (path.endsWith("/check-valid-employee")) {
      const body = request.postDataJSON();
      expect(Object.keys(body)).toEqual(["no_wa"]);
      const valid = body.no_wa === "081234567890" || body.no_wa === "+6281234567890";
      const gate = state.validationGate;
      state.validations.push(body.no_wa);
      if (gate) await gate;
      return route.fulfill({ status: state.validationStatus, contentType: "application/json", body: JSON.stringify({ success: state.validationStatus === 200, is_valid: valid }) });
    }
    if (path.endsWith("/transactions") && request.method() === "POST") {
      state.submissions.push(request.postDataJSON());
      if (state.rejectCheckout) return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Data nomor karyawan tidak unik atau tidak cocok. Hubungi admin untuk memperbarui data pengguna" } }) });
      return json(order);
    }
    if (path.endsWith("/transactions/phone-order")) {
      if (path.includes("/payments/")) return json({ transaction_id: order.id, status: "PENDING", creation_state: "UNCERTAIN", verification_pending: true, amount: 50000 });
      return json(order);
    }
    if (path.endsWith("/payments/checkout")) return json({ transaction_id: order.id, status: "PENDING", creation_state: "UNCERTAIN", verification_pending: true }, 202);
    if (path.endsWith("/location/stores")) return json([{ id: "phone-store", location_code: "WAM", location_name: "WAM Test", type: "store", status: "active" }]);
    return json([], 501); // Fixture tests never create company transactions or send notifications.
  });
  await context.addInitScript(() => {
    localStorage.setItem("selectedLocationCode", "WAM");
    sessionStorage.setItem("argopos.commerce.location-confirmed.v1", "WAM");
    localStorage.setItem("argopos.store.cart", JSON.stringify([{ productId: "phone-stock", qty: 1, productName: "Produk Test", productPrice: 50000, productStock: 4, productImageUrl: "/image/POKPOK%20PACKSHOT.png", tax_percentage: 0 }]));
  });
  return state;
}

for (const provider of ["MANUAL", "DOKU"] as const) {
  test(`internal phone checkout ${provider} uses users identifier`, async ({ page, context }, testInfo) => {
    const state = await setup(context, provider);
    await page.setViewportSize({ width: provider === "MANUAL" ? 390 : 1440, height: 960 });
    const errors: string[] = []; page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/WAM/commerce/cart");
    await page.getByRole("button", { name: "Karyawan internal", exact: true }).click();
    const phone = page.getByLabel("Nomor WhatsApp / ponsel karyawan", { exact: true });
    await expect(phone).toHaveAttribute("type", "tel");
    await phone.fill("089999999999");
    await expect(page.getByText("Nomor belum terdaftar", { exact: false })).toBeVisible();
    if (provider === "DOKU") {
      await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else await expect(page.getByRole("radio", { name: "Cutoff / Hutang" })).toHaveCount(0);
    expect(state.submissions).toHaveLength(0);
    await phone.fill("+6281234567890");
    await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toBeVisible();
    // Validated input remains editable; editing clears authorization immediately.
    await phone.fill("081234567890");
    await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toBeVisible();
    if (provider === "MANUAL") await page.getByText("Cutoff / Hutang", { exact: true }).click();
    await phone.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`internal-phone-${provider}.png`) });
    await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
    if (provider === "DOKU") {
      await page.getByRole("radio", { name: "Virtual Account BCA" }).click();
      expect(state.submissions).toHaveLength(0);
      await page.getByRole("button", { name: "Konfirmasi dan bayar", exact: true }).click();
    }
    await expect(page).toHaveURL(provider === "DOKU" ? /\/WAM\/commerce\/payment-maintenance\/phone-order$/ : /\/WAM\/commerce\/payment\/phone-order$/);
    expect(state.submissions).toHaveLength(1);
    expect(state.submissions[0]).toMatchObject({ customer_type: "INTERNAL", no_wa: "081234567890" });
    expect(state.submissions[0]).not.toHaveProperty("employee_code");
    expect(state.submissions[0]).not.toHaveProperty("customer_name");
    expect(errors).toEqual([]);
  });
}

test("late validation cannot approve an edited phone and a failed service stays invalid", async ({ context, page }) => {
  const state = await setup(context, "DOKU");
  await page.goto("/WAM/commerce/cart");
  await page.getByRole("button", { name: "Karyawan internal", exact: true }).click();
  const phone = page.getByLabel("Nomor WhatsApp / ponsel karyawan", { exact: true });
  let release!: () => void;
  state.validationGate = new Promise<void>((resolve) => { release = resolve; });
  await phone.fill("081234567890");
  await expect.poll(() => state.validations.length).toBe(1);
  state.validationGate = undefined;
  await phone.fill("089999999999");
  await expect(page.getByText("Nomor belum terdaftar", { exact: false })).toBeVisible();
  const response = page.waitForResponse((r) => r.url().endsWith("/check-valid-employee") && r.request().postDataJSON().no_wa === "081234567890");
  release(); await response;
  await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  expect(state.submissions).toHaveLength(0);
  state.validationStatus = 503;
  await phone.fill("081234567890");
  await expect(page.getByText("Validasi nomor belum tersedia", { exact: false })).toBeVisible();
  expect(state.submissions).toHaveLength(0);
});

test("customer type switches preserve immediate input and invalidate earlier phone responses", async ({ context, page }) => {
  const state = await setup(context, "DOKU");
  await page.goto("/WAM/commerce/cart");
  let release!: () => void;
  state.validationGate = new Promise<void>((resolve) => { release = resolve; });
  const internal = page.getByRole("button", { name: "Karyawan internal", exact: true });
  const phone = page.getByLabel("Nomor WhatsApp / ponsel karyawan", { exact: true });
  await internal.click();
  await phone.fill("081234567890");
  await expect(phone).toHaveValue("081234567890");
  await internal.click();
  await expect(phone).toHaveValue("081234567890");
  await expect.poll(() => state.validations.length).toBe(1);
  await page.getByRole("button", { name: "Pelanggan umum", exact: true }).click();
  await internal.click();
  await expect(phone).toHaveValue("");
  const response = page.waitForResponse((r) => r.url().endsWith("/check-valid-employee") && r.request().postDataJSON().no_wa === "081234567890");
  state.validationGate = undefined;
  release(); await response;
  await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toHaveCount(0);
  await phone.fill("+6281234567890");
  await expect(phone).toHaveValue("+6281234567890");
  await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toBeVisible();
  expect(state.submissions).toHaveLength(0);
});

test("server revalidation failure preserves cart and shows the error", async ({ context, page }) => {
  const state = await setup(context, "MANUAL"); state.rejectCheckout = true;
  await page.goto("/WAM/commerce/cart");
  await page.getByRole("button", { name: "Karyawan internal", exact: true }).click();
  await page.getByLabel("Nomor WhatsApp / ponsel karyawan", { exact: true }).fill("081234567890");
  await expect(page.getByText("Nomor karyawan terdaftar", { exact: true })).toBeVisible();
  await page.getByText("Cutoff / Hutang", { exact: true }).click();
  await page.getByRole("button", { name: "Lanjutkan pembayaran", exact: true }).click();
  await expect(page.getByText("Data nomor karyawan tidak unik atau tidak cocok.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/WAM\/commerce\/cart$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("argopos.store.cart") || "[]").length)).toBe(1);
});
