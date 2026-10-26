import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ video: "off" });

for (const width of [390, 820, 1440]) {
  test(`customer QR is scanned by staff and customer observes COMPLETED (${width}px)`, async ({ browser }, testInfo) => {
    const customer = await browser.newContext({ viewport: { width, height: 1000 } });
    const staff = await browser.newContext({ viewport: { width, height: 1000 } });
    const transactionId = "ecbf6589-0088-475c-bd24-f5347782b463";
    const payload = "celestia-pickup-v2." + Buffer.from(JSON.stringify({ transaction_id: transactionId, timestamp: 1792753200 })).toString("base64url") + ".signature-only-for-ui-test";
    let status = "READY_TO_PICKUP";
    let confirmations = 0;
    let qrRequests = 0;
    let transactionReads = 0;
    try {
      for (const context of [customer, staff]) {
        await context.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:4173" ? route.continue() : route.abort());
        await context.route("**/api/v1/**", async route => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          const json = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
          if (path.endsWith("/with-access")) return json({ id: "staff-role", role_name: "staff_internal", access_roles: ["transactions", "dashboard"].map(menu => ({ access_type: "write", menu: { id: menu, menu_name: menu } })) });
          if (path.endsWith("/users/")) return json({ id: "staff-id", role: { role_name: "staff_internal" }, assigned_stores: [{ id: "store-one", location_name: "Farm Benda" }] });
          if (path.endsWith("/FBND/store")) return json({ location_id: "store-one", location_code: "FBND", location_name: "Farm Benda", product_stores: [] });
          if (path.endsWith("/pickup-qr")) {
            qrRequests++;
            expect(request.method()).toBe("GET");
            return json({ transaction_id: transactionId, qr_payload: payload, issued_at: "2026-10-23T10:00:00Z" });
          }
          if (path.endsWith("/confirm-pickup-qr")) {
            expect(request.method()).toBe("POST");
            expect(request.headers().authorization).toBe("Bearer staff-test-jwt");
            expect(request.postDataJSON()).toEqual({ qr_payload: payload });
            confirmations++;
            status = "COMPLETED";
            return json({ transaction_id: transactionId, transaction_code: "TRX-DOKU-HANDOVER", status, already_completed: confirmations > 1 });
          }
          if (path.endsWith(`/payments/transactions/${transactionId}`)) return json({ transaction_id: transactionId, status: "PAID", amount: 83700, review_required: false });
          if (path.endsWith(`/transactions/${transactionId}`)) {
            transactionReads++;
            return json({ id: transactionId, transaction_code: "TRX-DOKU-HANDOVER", payment_provider: "DOKU", status, base_amount: 83700, total_amount: 83700, total_item: 3, transaction_carts: [] });
          }
          return json([]);
        });
      }
      await staff.addInitScript(() => {
        localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "staff-id", username: "Store Admin", role: "staff_internal", role_id: "staff-role" }));
        localStorage.setItem("argopos.auth.token", "staff-test-jwt");
      });
      const customerPage = await customer.newPage();
      await customerPage.clock.install();
      await customerPage.goto(`/FBND/commerce/payment-success/${transactionId}`);
      const qr = customerPage.getByRole("img", { name: "QR konfirmasi penyerahan barang" });
      await expect(qr).toBeVisible();
      await customerPage.clock.runFor(400);
      expect(qrRequests).toBe(1);
      await customerPage.clock.fastForward(24 * 60 * 60 * 1000);
      await expect(qr).toBeVisible();
      expect(qrRequests).toBe(1);
      await expect(customerPage.getByText(/Berlaku selama|5 menit/)).toHaveCount(0);
      expect(await customerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await customerPage.screenshot({ path: testInfo.outputPath("customer-handover-qr.png"), fullPage: true });
      // Download the actual customer PNG, then decode exactly those bytes in the staff scanner.
      const downloading = customerPage.waitForEvent("download");
      await customerPage.getByRole("button", { name: "Unduh QR (PNG)" }).click();
      const downloaded = await downloading;
      expect(downloaded.suggestedFilename()).toBe(`qr-penyerahan-${transactionId}.png`);
      const qrImage = await readFile((await downloaded.path())!);
      expect(qrImage.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(qrImage.readUInt32BE(16)).toBe(1024);
      expect(qrImage.readUInt32BE(20)).toBe(1024);
      const corner = await customerPage.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      }, qrImage.toString("base64"));
      expect(corner).toEqual([255, 255, 255, 255]);
      const staffPage = await staff.newPage();
      await staffPage.goto("/transactions/pickup-scan");
      await staffPage.getByLabel("Gambar QR penyerahan").setInputFiles({ name: "customer-qr.png", mimeType: "image/png", buffer: qrImage });
      await expect(staffPage.getByRole("heading", { name: "Penyerahan berhasil" })).toBeVisible();
      expect(confirmations).toBe(1);
      await customerPage.clock.fastForward(5000);
      await expect(customerPage.getByText("Transaksi berhasil diselesaikan")).toBeVisible();
      await expect(qr).toHaveCount(0);
      await expect(customerPage.getByRole("region", { name: "Status pesanan" }).locator('[aria-current="step"]')).toContainText("Pesanan diterima");
      await customerPage.screenshot({ path: testInfo.outputPath("customer-handover-completed.png"), fullPage: true });
      const readsAfterCompletion = transactionReads;
      await customerPage.clock.fastForward(310000);
      expect(transactionReads).toBe(readsAfterCompletion);
      expect(qrRequests).toBe(1);
    } finally {
      await customer.close();
      await staff.close();
    }
  });
}
