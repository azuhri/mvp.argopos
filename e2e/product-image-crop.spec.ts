import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const appUrl = "http://127.0.0.1:4173/celestia";

test("master product crops main and collection images to consistent JPEG output", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  let uploadBody = "";

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

  await page.route("**/backend/celestia/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith("/access-roles/role/role-super-admin/with-access")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "role-super-admin",
            role_name: "super_admin",
            access_roles: [
              {
                id: "access-products",
                access_type: "write",
                menu: { id: "menu-products", menu_name: "master_products" },
              },
            ],
          },
        }),
      });
      return;
    }

    if (path.endsWith("/users/")) {
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
      return;
    }

    if (path.endsWith("/products/list")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            products: [],
            meta: { page: 1, page_size: 10, total: 0, total_pages: 0 },
          },
        }),
      });
      return;
    }

    if (path.endsWith("/products") && request.method() === "POST") {
      uploadBody = request.postDataBuffer()?.toString("latin1") || "";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "product-1",
            product_code: "AMP-CROP-001",
            product_name: "Produk Crop QA",
            description: "Produk hasil crop",
            base_price: 25_000,
            image_path: "products/product-1.jpg",
            created_at: new Date().toISOString(),
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ success: false }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${appUrl}/master/products`);
  await page.getByRole("button", { name: "Add Product" }).click();

  const mainImagePath = resolve("public/image/POKPOK PACKSHOT.png");
  const collectionImagePath = resolve("public/image/NUGGET PACKSHOT.PNG");
  await page.locator("#image_path").setInputFiles(mainImagePath);
  await expect(page.getByRole("heading", { name: "Atur gambar produk" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("crop-dialog-desktop.png") });
  await page.getByRole("button", { name: "Terapkan crop" }).click();

  const mainPreview = page.getByRole("img", { name: "New Product" });
  await expect(mainPreview).toBeVisible();
  await expect.poll(() => mainPreview.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([1200, 1200]);

  await page.locator("#image_collection_url").setInputFiles([
    mainImagePath,
    collectionImagePath,
  ]);
  await expect(page.getByText("1 dari 2")).toBeVisible();
  await page.getByRole("button", { name: "Terapkan crop" }).click();
  await expect(page.getByText("2 dari 2")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("crop-dialog-mobile.png") });
  await page.getByRole("button", { name: "Terapkan crop" }).click();

  const collectionPreviews = page.getByRole("img", { name: /New Collection/ });
  await expect(collectionPreviews).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect.poll(() => collectionPreviews.nth(index).evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([1200, 1200]);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByPlaceholder("Product Code").fill("AMP-CROP-001");
  await page.getByPlaceholder("Product Name").fill("Produk Crop QA");
  await page.getByPlaceholder("Product Description").fill("Produk hasil crop");
  await page.getByPlaceholder("Masukkan harga dasar").fill("25000");
  await page.getByRole("button", { name: "Create Product" }).click();

  await expect.poll(() => uploadBody.length).toBeGreaterThan(0);
  expect(uploadBody).toContain('name="image_path"');
  expect(uploadBody).toContain('name="image_collection_url"');
  expect(uploadBody).toContain("image/jpeg");
  expect(uploadBody).toContain("-1200x1200.jpg");
  expect(uploadBody).not.toContain("image/png");
});
