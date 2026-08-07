import { expect, test, type Page } from "@playwright/test";

const appUrl = "http://127.0.0.1:4173/celestia";

const menuNames = [
  "dashboard",
  "transactions",
  "customers",
  "koperasi",
  "master_users",
  "master_products",
  "master_locations",
  "master_stock",
  "master_stores",
  "master_roles",
  "master_stock_mutations",
];

async function mockAuthenticatedAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "argopos.auth.user",
      JSON.stringify({
        id: "user-super-admin",
        username: "superadmin",
        email: "admin@celestia.test",
        role: "super_admin",
        role_id: "role-super-admin",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      }),
    );
    localStorage.setItem("argopos.auth.token", "qa-token");
  });

  await page.route("**/access-roles/role/role-super-admin/with-access", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "role-super-admin",
          role_name: "super_admin",
          access_roles: menuNames.map((menuName, index) => ({
            id: `access-${index}`,
            access_type: "write",
            menu: { id: `menu-${index}`, menu_name: menuName },
          })),
        },
      }),
    });
  });

  await page.route("**/users/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "user-super-admin",
          username: "superadmin",
          email: "admin@celestia.test",
          assigned_stores: [],
        },
      }),
    });
  });
}

test("admin dashboard is usable and responsive on desktop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAuthenticatedAdmin(page);

  await page.route("**/dashboard/analytics/overview**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          summary: {
            total_revenue: 186400000,
            total_transactions: 1284,
            unique_customers: 842,
            internal_customers: 615,
            external_customers: 227,
            revenue_growth: 12.8,
            previous_revenue: 165240000,
            period_start: "2026-07-01T00:00:00Z",
            period_end: "2026-07-30T00:00:00Z",
          },
          revenue_trend: [
            { label: "01 Jul", month: "2026-07", revenue: 22000000 },
            { label: "08 Jul", month: "2026-07", revenue: 29500000 },
            { label: "15 Jul", month: "2026-07", revenue: 41000000 },
            { label: "22 Jul", month: "2026-07", revenue: 36500000 },
            { label: "30 Jul", month: "2026-07", revenue: 57400000 },
          ],
          category_distribution: [
            { name: "Frozen food", value: 42.5, raw_value: 545 },
            { name: "Minuman", value: 24.2, raw_value: 311 },
            { name: "Sembako", value: 19.1, raw_value: 245 },
            { name: "Lainnya", value: 14.2, raw_value: 183 },
          ],
          recent_transactions: [
            {
              id: "transaction-1",
              invoice_number: "INV-2026-0801",
              customer_name: "Budi Santoso",
              store_name: "Celestia Bandung",
              total: 485000,
              status: "PAID",
              created_at: "2026-08-04T08:12:00Z",
            },
            {
              id: "transaction-2",
              invoice_number: "INV-2026-0800",
              customer_name: "Siti Rahma",
              store_name: "Celestia Jakarta",
              total: 725000,
              status: "COMPLETED",
              created_at: "2026-08-04T07:46:00Z",
            },
          ],
        },
      }),
    });
  });

  await page.goto(`${appUrl}/dashboard`);

  await expect(page.getByRole("heading", { name: "Ringkasan bisnis" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "INV-2026-0801", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Cari menu" }).fill("location");
  await expect(page.getByRole("option", { name: /Location Management/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Cari menu" }).press("Escape");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await expect(page.getByRole("navigation", { name: "Navigasi mobile" })).toBeVisible();
  const mobileHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(mobileHasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
});

test("location management follows the catalog design system", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAuthenticatedAdmin(page);

  await page.route("**/locations/list?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          locations: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              location_code: "WH-JKT-01",
              location_name: "Warehouse Jakarta",
              type: "warehouse",
              longitude: 106.8456,
              latitude: -6.2088,
              is_active: true,
              created_at: "2026-08-01T00:00:00Z",
              updated_at: "2026-08-01T00:00:00Z",
            },
          ],
          meta: { page: 1, page_size: 10, total: 1 },
        },
      }),
    });
  });

  await page.goto(`${appUrl}/master/locations`);

  await expect(page.getByRole("heading", { name: "Master Lokasi" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Warehouse Jakarta", exact: true })).toBeVisible();

  const primaryToken = await page.locator(".admin-theme").first().evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--primary").trim(),
  );
  expect(primaryToken).toBe("224 84% 17%");

  const createButtonColor = await page
    .getByRole("button", { name: "Tambah Lokasi" })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(createButtonColor).toBe("rgb(227, 6, 19)");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("master-locations-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(550);
  await page.screenshot({ path: testInfo.outputPath("master-locations-dark.png"), fullPage: true });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.waitForTimeout(550);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await expect(page.getByText("Warehouse Jakarta", { exact: true })).toBeVisible();
  const mobileHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(mobileHasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("master-locations-mobile.png"), fullPage: true });
});

test("login remains usable on desktop and mobile viewports", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${appUrl}/auth/sign-in`);

  await expect(page.getByRole("heading", { name: "Selamat datang kembali" })).toBeVisible();
  await expect(page.getByText("Workspace operasional")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("login-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Selamat datang kembali" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({ path: testInfo.outputPath("login-mobile.png"), fullPage: true });
});

test("store stock management deep link supports warehouse receipt approval", async ({ page }, testInfo) => {
  const storeId = "0d43fee5-6dd3-4050-8cb9-b107cfbe2043";
  let received = false;
  let requestedDestination = "";

  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockAuthenticatedAdmin(page);

  await page.route(`**/stores/${storeId}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          location_id: storeId,
          location_name: "AMP Mart Bandung",
          location_code: "AMP-BDG",
          total_revenue: 0,
          total_transactions: 0,
          total_stock: received ? 125 : 100,
          product_stores: [],
          assigned_users: [],
          payment_methods: [],
          time_open_store: "08:00",
          time_close_store: "20:00",
          time_start_pickup: "09:00",
          time_end_pickup: "18:00",
        },
      }),
    });
  });

  await page.route("**/dashboard/analytics/overview**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          summary: {
            total_revenue: 0,
            total_transactions: 0,
            internal_customers: 0,
            external_customers: 0,
          },
        },
      }),
    });
  });

  await page.route("**/stocks/transfer-requests?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    requestedDestination = requestUrl.searchParams.get("to_location_id") || "";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          requests: [{
            id: "transfer-request-1",
            movement_type: "distribution",
            from_location_id: "warehouse-1",
            to_location_id: storeId,
            master_product_id: "product-1",
            quantity: 25,
            status: received ? "completed" : "source_approved",
            notes: "Restock mingguan",
            rejection_reason: "",
            created_at: "2026-08-07T07:30:00Z",
            updated_at: "2026-08-07T07:30:00Z",
            from_location: { location_name: "Warehouse Jakarta" },
            master_product: { product_name: "Sosis Ayam Cocktail" },
          }],
          meta: { page: 1, page_size: 10, total: 1, total_pages: 1 },
        },
      }),
    });
  });

  await page.route("**/stocks/transfer-requests/transfer-request-1/receive", async (route) => {
    received = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { id: "transfer-request-1", status: "completed" } }),
    });
  });

  await page.goto(`${appUrl}/master/store/${storeId}?tab=stock-management`);

  await expect(page.getByRole("heading", { name: "Penerimaan stock" })).toBeVisible();
  await expect(page.getByText("Sosis Ayam Cocktail").first()).toBeVisible();
  expect(requestedDestination).toBe(storeId);

  await page.getByRole("button", { name: "Konfirmasi diterima" }).first().click();
  await expect(page.getByRole("heading", { name: "Konfirmasi stock sudah diterima?" })).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi diterima" }).last().click();
  await expect(page.getByText("Diterima").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Konfirmasi stock sudah diterima?" })).toBeHidden();
  await page.waitForTimeout(300);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("stock-management-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await expect(page.getByText("Sosis Ayam Cocktail").last()).toBeVisible();
  const mobileHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(mobileHasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("stock-management-mobile.png"), fullPage: true });
});
