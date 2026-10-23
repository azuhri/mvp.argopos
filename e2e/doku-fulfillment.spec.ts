import { expect, test } from "@playwright/test";

test.use({ video: "off" });

for (const path of ["/transactions", "/master/store/pickup-store?tab=transaction"]) {
  for (const width of [1440, 390]) {
    test(`DOKU preparation and staff proof at ${path}, ${width}px`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 950 });
      await page.addInitScript(() => {
        localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "staff-test", username: "Staff Test", email: "staff@example.test", role: "super_admin", role_id: "staff-role" }));
        localStorage.setItem("argopos.auth.token", "mock-staff-token");
      });
      let status = "PAID";
      let proof = "";
      let preparations = 0, uploads = 0;
      const order = () => ({
        id: "pickup-order", transaction_code: "TRX-DOKU-PICKUP", master_location_id: "pickup-store",
        payment_provider: "DOKU", status, path_proof_pickup: proof,
        paid_at: "2026-10-23T01:00:00Z", created_at: "2026-10-23T00:50:00Z",
        total_amount: 27900, base_amount: 27900, total_item: 1, location_name: "Pickup Store", customer_name: "Customer Test",
      });
      await context.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        const json = (data: unknown, meta?: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data, meta }) });
        if (endpoint.endsWith("/with-access")) return json({ id: "staff-role", role_name: "super_admin", access_roles: ["transactions", "master_stores"].map((menu) => ({ id: menu, access_type: "write", menu: { id: menu, menu_name: menu } })) });
        if (endpoint.endsWith("/users/")) return json({ id: "staff-test", role: { role_name: "super_admin" }, assigned_stores: [] });
        if (endpoint.endsWith("/stores/pickup-store")) return json({ id: "pickup-store", location_id: "pickup-store", location_name: "Pickup Store", location_code: "PICKUP", assigned_users: [], payment_methods: [], product_stores: [] });
        if (endpoint.endsWith("/stores/pickup-store/transactions")) return json([order()], { total: 1 });
        if (endpoint.endsWith("/transactions/required")) return json({ transactions: [order()], meta: { total: 1, page: 1, page_size: 20 } });
        if (endpoint.endsWith("/approve-delivery")) {
          expect(endpoint).toContain("/transactions/required/pickup-order/");
          expect(request.method()).toBe("POST");
          expect(request.headers().authorization).toBe("Bearer mock-staff-token");
          expect(status).toBe("PAID");
          preparations++;
          status = "PREPARING_PRODUCT";
          return json(null);
        }
        if (endpoint.endsWith("/upload-pickup-proof")) {
          expect(endpoint).toContain("/transactions/required/pickup-order/");
          expect(request.headers().authorization).toBe("Bearer mock-staff-token");
          expect(request.headers()["content-type"]).toContain("multipart/form-data");
          expect(status).toBe("PREPARING_PRODUCT");
          expect(preparations).toBe(1);
          uploads++;
          status = "READY_TO_PICKUP";
          proof = "proof.png";
          return json({ path_proof_pickup: proof, status, pickup_at: "2026-10-23T02:00:00Z" });
        }
        return json([]);
      });
      await page.goto(path);
      const prepare = page.getByRole("button", { name: "Mulai persiapan", exact: true }).filter({ visible: true });
      await expect(prepare).toBeEnabled();
      await expect(page.getByRole("button", { name: "Upload Bukti", exact: true }).filter({ visible: true })).toHaveCount(0);
      expect(preparations).toBe(0);
      await prepare.click();
      const upload = page.getByRole("button", { name: "Upload Bukti", exact: true }).filter({ visible: true });
      await expect(upload).toBeVisible();
      expect(uploads).toBe(0);
      await upload.click();
      const dialog = page.getByRole("dialog", { name: "Upload Bukti Serah Terima" });
      await dialog.locator('input[type="file"]').setInputFiles({
        name: "proof.png", mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
      });
      await dialog.getByRole("button", { name: "Upload Bukti", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect.poll(() => uploads).toBe(1);
      expect(preparations).toBe(1);
      expect(status).toBe("READY_TO_PICKUP");
      await expect(page.getByRole("button", { name: "Upload Bukti", exact: true }).filter({ visible: true })).toHaveCount(0);
      expect(await context.cookies()).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("doku-fulfillment.png"), fullPage: true });
    });
  }
}
