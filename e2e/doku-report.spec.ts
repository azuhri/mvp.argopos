import { expect, test } from "@playwright/test";

test("finance report filters, settlement preview and CSV export (mock API)", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "finance-user", username: "Finance Admin", email: "finance@example.test", role: "super_admin", role_id: "finance-role" }));
    localStorage.setItem("argopos.auth.token", "mock-finance-token");
  });
  let imports = 0;
  let filteredInvoice = "";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (data: unknown, meta?: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data, meta }) });
    if (url.pathname.endsWith("/with-access")) return json({ id: "finance-role", role_name: "super_admin", access_roles: [{ id: "access-one", access_type: "write", menu: { id: "menu-one", menu_name: "transactions" } }] });
    if (url.pathname.endsWith("/users/")) return json({ id: "finance-user", assigned_stores: [] });
    if (url.pathname.endsWith("/payments/admin/settlements")) { imports += 1; return json({ imported: 1 }); }
    if (url.pathname.endsWith("/payments/admin/reconciliation")) {
      if (url.searchParams.get("format") === "csv") return route.fulfill({ contentType: "text/csv", body: "invoice_number,reconciliation_status\nCEL-FINANCE-ONE,MISSING_SETTLEMENT\n" });
      return json([{ invoice_number: "CEL-FINANCE-ONE", payment_status: "PAID", reconciliation_status: "MISSING_SETTLEMENT", gross_amount: null, fee_amount: null, net_amount: null }], { total: 1 });
    }
    if (url.pathname.endsWith("/payments/admin")) {
      filteredInvoice = url.searchParams.get("invoice") || "";
      expect(request.headers().authorization).toBe("Bearer mock-finance-token");
      return json([{ payment_id: "payment-one", invoice_number: "CEL-FINANCE-ONE", transaction_id: "order-one", status: "PAID", amount: 50000, channel: "VIRTUAL_ACCOUNT_BCA", created_at: "2026-10-22T03:00:00Z" }], { total: 1 });
    }
    return json([]);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/payments");
  await expect(page.getByRole("main").getByRole("heading", { name: "Pembayaran DOKU" })).toBeVisible();
  await expect(page.getByText("MISSING_SETTLEMENT", { exact: true })).toBeVisible();
  await page.getByLabel("Invoice", { exact: true }).fill("CEL-FINANCE");
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect.poll(() => filteredInvoice).toBe("CEL-FINANCE");
  await page.screenshot({ path: testInfo.outputPath("doku-report-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("doku-report-mobile.png"), fullPage: true });
  await page.getByLabel("Data laporan yang telah dinormalisasi (JSON)").fill(JSON.stringify({ records: [{ external_id: "external-one", invoice_number: "CEL-FINANCE-ONE", gross_amount: 50000, fee_amount: 500, net_amount: 49500, settled_at: "2026-10-22T11:00:00+07:00" }] }));
  await page.getByRole("button", { name: "Periksa data impor" }).click();
  expect(imports).toBe(0);
  await page.getByRole("button", { name: "Konfirmasi impor settlement" }).click();
  await expect.poll(() => imports).toBe(1);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor rekonsiliasi CSV" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("rekonsiliasi-doku.csv");
});
