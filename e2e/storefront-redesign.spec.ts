import { expect, type Page, test } from "@playwright/test";

const appUrl = "http://127.0.0.1:4173/celestia";
const productImage = `${appUrl}/image/POKPOK%20PACKSHOT.png`;

const store = {
  location_id: "location-1",
  location_name: "AMP Mart Jakarta",
  location_code: "AMP-JKT",
  total_stock: 62,
  time_open_store: "08:00:00",
  time_close_store: "20:00:00",
  time_start_pickup: "09:00:00",
  time_end_pickup: "18:00:00",
  product_stores: [
    {
      id: "stock-pokpok",
      stock: 18,
      base_price: 32000,
      discount_price: 28500,
      final_price: 28500,
      tax_percentage: 0,
      master_product: {
        id: "product-pokpok",
        product_name: "Chicken Pokpok Premium 400 gr",
        product_code: "AMP-PPK-400",
        image_path: "",
        image_url: productImage,
        category: "Olahan Ayam",
      },
    },
    {
      id: "stock-nugget",
      stock: 24,
      base_price: 41000,
      discount_price: 0,
      final_price: 41000,
      tax_percentage: 0,
      master_product: {
        id: "product-nugget",
        product_name: "Chicken Nugget Crispy 500 gr",
        product_code: "AMP-NGT-500",
        image_path: "",
        image_url: `${appUrl}/image/NUGGET%20PACKSHOT.PNG`,
        category: "Frozen Food",
      },
    },
    {
      id: "stock-sosis",
      stock: 20,
      base_price: 37500,
      discount_price: 34500,
      final_price: 34500,
      tax_percentage: 0,
      master_product: {
        id: "product-sosis",
        product_name: "Sosis Cocktail Ayam 500 gr",
        product_code: "AMP-SSS-500",
        image_path: "",
        image_url: `${appUrl}/image/SOSIS%20COCKTAIL%20PACKSHOT.png`,
        category: "Olahan Ayam",
      },
    },
  ],
};

const transaction = {
  id: "transaction-1",
  master_location_id: "location-1",
  customer_id: "customer-1",
  customer_name: "Dewi Anggraini",
  status: "READY_TO_PICKUP",
  payment_code: "42",
  payment_method_id: "payment-transfer",
  nominal_code: "42",
  base_amount: 57000,
  total_amount: 57042,
  total_item: 2,
  transaction_code: "TRX-AMP-20260805-001",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
  transaction_carts: [
    {
      id: "cart-1",
      product_stock_id: "stock-pokpok",
      amount: 57000,
      qty: 2,
      product_details: {
        product_name: "Chicken Pokpok Premium 400 gr",
        image_path: productImage,
      },
    },
  ],
};

async function mockStorefrontApi(page: Page) {
  await page.route("**/backend/celestia/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/location/stores")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "location-1",
              location_code: "AMP-JKT",
              location_name: "AMP Mart Jakarta",
              type: "store",
              status: "active",
              is_active: true,
            },
          ],
        }),
      });
      return;
    }

    if (path.endsWith("/AMP-JKT/store")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: store }) });
      return;
    }

    if (path.endsWith("/location/stores/operational-status")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            is_open: true,
            current_time: "14:00",
            store_open_time: "08:00:00",
            store_close_time: "20:00:00",
            pickup_start_time: "09:00:00",
            pickup_end_time: "18:00:00",
            is_within_pickup_window: true,
          },
        }),
      });
      return;
    }

    if (path.endsWith("/stores/location-1/payment-methods")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "payment-transfer",
              location_id: "location-1",
              payment_type: "transfer_rekening",
              image_url: "",
              bank_name: "Bank Mandiri",
              account_number: "1234567890",
              account_name: "PT Argo Manunggal Proteindo",
              is_active: true,
            },
            {
              id: "payment-qris",
              location_id: "location-1",
              payment_type: "qris",
              image_url: "",
              bank_name: "",
              account_number: "",
              account_name: "AMP Mart",
              is_active: true,
            },
          ],
        }),
      });
      return;
    }

    if (path.endsWith("/stores/location-1/assigned-users")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ id: "admin-1", username: "Admin AMP Jakarta", email: "admin@amp.test", no_wa: "628123456789" }],
        }),
      });
      return;
    }

    if (path.endsWith("/transactions/transaction-1/confirm-receipt") && request.method() === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }

    if (path.endsWith("/transactions/transaction-1")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: transaction }) });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false }) });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
}

test("storefront journey matches the retail reference on desktop and mobile", async ({ page }, testInfo) => {
  await mockStorefrontApi(page);
  await page.addInitScript(({ imageUrl }) => {
    localStorage.setItem("selectedLocationCode", "AMP-JKT");
    localStorage.setItem(
      "argopos.store.cart",
      JSON.stringify([
        {
          productId: "stock-pokpok",
          qty: 2,
          productName: "Chicken Pokpok Premium 400 gr",
          productPrice: 28500,
          productImageUrl: imageUrl,
          productStock: 18,
          productStockId: "stock-pokpok",
          tax_percentage: 0,
        },
      ]),
    );
  }, { imageUrl: productImage });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${appUrl}/commerce`);
  await expect(page.getByRole("heading", { name: /Frozen food siap pickup/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "AMP Mart, kembali ke katalog" })).toBeVisible();
  await expect(page.getByText("Chicken Pokpok Premium 400 gr").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("store-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await expect(page.getByRole("button", { name: "Filter" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("store-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${appUrl}/AMP-JKT/commerce/cart`);
  await expect(page.getByRole("heading", { name: "Keranjang belanja" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Produk pilihan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metode pembayaran" })).toBeVisible();
  await page.getByText("Transfer Rekening", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Lanjutkan pembayaran" })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("cart-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await expect(page.getByRole("button", { name: "Pelanggan umum" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("cart-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${appUrl}/AMP-JKT/commerce/payment/transaction-1`);
  await expect(page.getByRole("heading", { name: "Detail pembayaran" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Pesanan siap diambil di outlet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ringkasan transaksi" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("payment-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await expect(page.getByRole("button", { name: /Konfirmasi barang diterima/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("payment-mobile.png"), fullPage: true });

  transaction.status = "COMPLETED";
  await page.getByRole("button", { name: /Konfirmasi barang diterima/i }).click();
  await expect(page).toHaveURL(`${appUrl}/AMP-JKT/commerce/payment-success/transaction-1`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("heading", { name: "Terima kasih telah berbelanja" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transaksi berhasil diselesaikan" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("success-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await expect(page.getByRole("link", { name: /Belanja lagi/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("success-mobile.png"), fullPage: true });
});
