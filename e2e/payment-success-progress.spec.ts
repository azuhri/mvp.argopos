import { expect, test } from "@playwright/test";

test.use({ video: "off" });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`customer sees preparation and pickup progress without reloading (${viewport.width}px)`, async ({ page, context }, testInfo) => {
    await page.setViewportSize(viewport);
    let status = "PAID";
    let transactionRequests = 0;
    let paymentRequests = 0;
    let mutations = 0;
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const send = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
      if (request.method() !== "GET") mutations++;
      if (path.endsWith("/FBND/store")) return send({ location_id: "progress-store", location_code: "FBND", location_name: "Farm Benda", product_stores: [] });
      if (path.endsWith("/payments/transactions/progress-order")) {
        paymentRequests++;
        return send({ payment_id: "progress-payment", transaction_id: "progress-order", invoice_number: "CEL-PROGRESS", status: "PAID", amount: 27900, review_required: false });
      }
      if (path.endsWith("/transactions/progress-order")) {
        transactionRequests++;
        return send({
          id: "progress-order", transaction_code: "TRX-DOKU-PROGRESS", payment_provider: "DOKU", status,
          base_amount: 27900, total_amount: 27900, total_item: 1,
          transaction_carts: [{ id: "line-one", qty: 1, amount: 27900, product_details: { product_name: "Sosis Ayam Cocktail" } }],
        });
      }
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false }) });
    });
    await page.clock.install();
    await page.goto("/FBND/commerce/payment-success/progress-order");
    await expect(page.getByRole("heading", { name: "Pembayaran berhasil" })).toBeVisible();
    const progress = page.getByRole("region", { name: "Status pesanan" });
    const currentStep = progress.locator('[aria-current="step"]');
    await expect(currentStep).toContainText("Menunggu persiapan");
    await expect(page.getByRole("button", { name: /Mulai persiapan|Upload Bukti/ })).toHaveCount(0);
    expect(transactionRequests).toBe(1);
    status = "PREPARING_PRODUCT";
    await page.clock.fastForward(4000);
    expect(transactionRequests).toBe(1);
    await page.clock.fastForward(1000);
    await expect(currentStep).toContainText("Sedang disiapkan");
    await expect(progress.getByText(/Setelah bukti diunggah/)).toBeVisible();
    status = "READY_TO_PICKUP";
    await page.clock.fastForward(5000);
    await expect(currentStep).toContainText("Siap diambil");
    await expect(page.getByRole("button", { name: "Unduh invoice PDF" })).toBeEnabled();
    await expect(page.getByRole("link", { name: "Lihat detail transaksi" })).toHaveAttribute("href", "/FBND/commerce/payment/progress-order?view=order");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`payment-ready-${viewport.width}.png`), fullPage: true });
    status = "COMPLETED";
    await page.clock.fastForward(5000);
    await expect(currentStep).toContainText("Pesanan diterima");
    await expect(page.getByText("Transaksi berhasil diselesaikan")).toBeVisible();
    await expect(progress.getByText(/Status diperbarui otomatis/)).toHaveCount(0);
    expect(transactionRequests).toBe(4);
    await page.clock.fastForward(20000);
    expect(transactionRequests).toBe(4);
    expect(paymentRequests).toBe(1);
    expect(mutations).toBe(0);
  });
}
