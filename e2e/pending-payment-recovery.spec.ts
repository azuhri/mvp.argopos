import { expect, type BrowserContext, test } from "@playwright/test";

const appUrl = "http://127.0.0.1:4173/celestia";
const storageKey = "argopos.store.pending-payments.v1";
const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

interface PendingPaymentMockState {
  status: string;
  createRequests: number;
  omitDetailExpiry?: boolean;
  detailRequests?: number;
  detailRequestedFromCart?: boolean;
}

function countdownToSeconds(value: string | null) {
  if (!value) return Number.NaN;
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

const store = {
  location_id: "location-1",
  location_name: "AMP Mart Jakarta",
  location_code: "AMP-JKT",
  total_stock: 18,
  time_open_store: "08:00:00",
  time_close_store: "20:00:00",
  time_start_pickup: "09:00:00",
  time_end_pickup: "18:00:00",
  product_stores: [
    {
      id: "stock-pokpok",
      stock: 18,
      base_price: 32_000,
      discount_price: 28_500,
      final_price: 28_500,
      tax_percentage: 0,
      master_product: {
        id: "product-pokpok",
        product_name: "Chicken Pokpok Premium 400 gr",
        product_code: "AMP-PPK-400",
        image_path: "",
        image_url: `${appUrl}/image/POKPOK%20PACKSHOT.png`,
        category: "Olahan Ayam",
      },
    },
  ],
};

const transaction = {
  id: "transaction-pending-1",
  master_location_id: "location-1",
  status: "WAITING_TO_PAYMENT",
  payment_method_id: "payment-transfer",
  payment_code: "42",
  nominal_code: "42",
  base_amount: 28_500,
  total_amount: 28_542,
  total_item: 0,
  transaction_code: "TRX-PENDING-001",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  expires_at: expiresAt,
  transaction_carts: [
    {
      id: "cart-pending-1",
      product_stock_id: "stock-pokpok",
      amount: 28_500,
      qty: 1,
      product_details: {
        product_name: "Chicken Pokpok Premium 400 gr",
        image_path: "",
      },
    },
  ],
};

async function mockPendingPaymentApi(
  context: BrowserContext,
  state: PendingPaymentMockState,
) {
  await context.route("**/backend/celestia/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

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
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: store }),
      });
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
          ],
        }),
      });
      return;
    }

    if (path.endsWith("/stores/location-1/assigned-users")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    if (path.endsWith("/transactions/check-customer-by-no-wa")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, exists: false }),
      });
      return;
    }

    if (path.endsWith("/transactions") && request.method() === "POST") {
      state.createRequests += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ...transaction,
            expires_at: undefined,
            status: state.status,
          },
        }),
      });
      return;
    }

    if (path.endsWith(`/transactions/${transaction.id}`)) {
      state.detailRequests = (state.detailRequests || 0) + 1;
      if (request.frame().url().endsWith("/commerce/cart")) {
        state.detailRequestedFromCart = true;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ...transaction,
            expires_at: state.omitDetailExpiry ? undefined : transaction.expires_at,
            status: state.status,
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
}

test("customer can recover and resume the original pending payment", async ({ context, page }, testInfo) => {
  const state: PendingPaymentMockState = {
    status: "WAITING_TO_PAYMENT",
    createRequests: 0,
  };
  await mockPendingPaymentApi(context, state);
  await context.addInitScript(({ imageUrl }) => {
    localStorage.setItem("selectedLocationCode", "AMP-JKT");
    localStorage.setItem(
      "argopos.store.cart",
      JSON.stringify([
        {
          productId: "stock-pokpok",
          qty: 1,
          productName: "Chicken Pokpok Premium 400 gr",
          productPrice: 28_500,
          productImageUrl: imageUrl,
          productStock: 18,
          productStockId: "stock-pokpok",
          tax_percentage: 0,
        },
      ]),
    );
  }, { imageUrl: store.product_stores[0].master_product.image_url });

  await page.goto(`${appUrl}/AMP-JKT/commerce/cart`);
  await page.getByLabel("Nomor WhatsApp").fill("628123456789");
  await page.getByLabel("Nama pelanggan").fill("Dewi Anggraini");
  await page.getByLabel("Email").fill("dewi@example.test");
  await page.getByText("Transfer Rekening", { exact: true }).click();
  await page.getByRole("button", { name: "Lanjutkan pembayaran" }).click();

  await expect(page).toHaveURL(
    `${appUrl}/AMP-JKT/commerce/payment/${transaction.id}`,
  );
  await expect(page.getByTestId("payment-countdown")).toHaveText(
    /^(01:59|02:00):\d{2}$/,
  );
  const initialCountdown = countdownToSeconds(
    await page.getByTestId("payment-countdown").textContent(),
  );
  await expect.poll(
    async () => countdownToSeconds(
      await page.getByTestId("payment-countdown").textContent(),
    ),
  ).toBeLessThan(initialCountdown);
  await expect(page.getByTestId("transaction-item-count")).toHaveText(
    "1 item dalam transaksi",
  );
  await expect(page.getByRole("button", { name: "Bayar nanti" })).toBeVisible();
  expect(state.detailRequestedFromCart).toBe(true);

  const expectedPendingStorage = {
    version: 1,
    items: [
      {
        transaction_id: transaction.id,
        transaction_code: transaction.transaction_code,
        location_code: store.location_code,
        location_name: store.location_name,
        total_amount: transaction.total_amount,
        status: "WAITING_TO_PAYMENT",
        created_at: transaction.created_at,
        expires_at: transaction.expires_at,
      },
    ],
  };
  await expect.poll(
    () => page.evaluate((key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }, storageKey),
  ).toEqual(expectedPendingStorage);

  const persisted = await page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, storageKey);
  expect(JSON.stringify(persisted)).not.toContain("Dewi Anggraini");
  expect(JSON.stringify(persisted)).not.toContain("628123456789");
  await page.screenshot({
    path: testInfo.outputPath("payment-detail-desktop.png"),
    fullPage: true,
  });

  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await page.getByRole("button", { name: "Bayar nanti" }).click();
  await expect(page).toHaveURL(`${appUrl}/AMP-JKT/commerce`);
  await expect.poll(
    () => page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).not.toBeNull();
  await expect(page.getByRole("heading", { name: "Pembayaran tertunda" })).toBeVisible();
  await expect(page.getByText(transaction.transaction_code).first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("pending-payment-desktop.png"),
    fullPage: true,
  });

  await page.close();
  const reopenedPage = await context.newPage();
  await reopenedPage.setViewportSize({ width: 390, height: 844 });
  await reopenedPage.goto(`${appUrl}/commerce`);
  await expect(reopenedPage.getByRole("heading", { name: "Pembayaran tertunda" })).toBeVisible();
  await expect.poll(
    () => reopenedPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await reopenedPage.screenshot({
    path: testInfo.outputPath("pending-payment-mobile.png"),
    fullPage: true,
  });
  await reopenedPage.getByRole("link", { name: /Lanjutkan pembayaran/i }).click();
  await expect(reopenedPage).toHaveURL(
    `${appUrl}/AMP-JKT/commerce/payment/${transaction.id}`,
  );
  await expect(reopenedPage.getByTestId("payment-countdown")).not.toHaveText(
    "00:00:00",
  );
  await expect.poll(
    () => reopenedPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await reopenedPage.screenshot({
    path: testInfo.outputPath("payment-detail-mobile.png"),
    fullPage: true,
  });
  expect(state.createRequests).toBe(1);

  state.status = "PAID";
  await reopenedPage.goto(`${appUrl}/commerce`);
  await expect.poll(
    () => reopenedPage.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
  await expect(
    reopenedPage.getByRole("heading", { name: "Pembayaran tertunda" }),
  ).toHaveCount(0);
  expect(state.createRequests).toBe(1);
});

test("payment detail still renders while expiry metadata is unavailable", async ({ context, page }) => {
  const state: PendingPaymentMockState = {
    status: "WAITING_TO_PAYMENT",
    createRequests: 0,
    omitDetailExpiry: true,
  };
  await mockPendingPaymentApi(context, state);

  await page.goto(`${appUrl}/AMP-JKT/commerce/payment/${transaction.id}`);

  await expect(page.getByRole("heading", { name: "Detail pembayaran" })).toBeVisible();
  await expect(page.getByText(transaction.transaction_code).first()).toBeVisible();
  await expect(page.getByTestId("payment-countdown")).toHaveText("--:--:--");
  await expect(page.getByRole("button", { name: "Bayar nanti" })).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Transaksi tidak dapat dimuat" }),
  ).toHaveCount(0);

  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, {
    key: storageKey,
    value: {
      version: 1,
      items: [
        {
          transaction_id: transaction.id,
          transaction_code: transaction.transaction_code,
          location_code: store.location_code,
          location_name: store.location_name,
          total_amount: transaction.total_amount,
          status: "WAITING_TO_PAYMENT",
          created_at: transaction.created_at,
          expires_at: transaction.expires_at,
        },
      ],
    },
  });
  await page.reload();

  await expect(page.getByTestId("payment-countdown")).toHaveText(
    /^(01:59|02:00):\d{2}$/,
  );
  await expect(page.getByRole("button", { name: "Bayar nanti" })).toBeEnabled();
});
