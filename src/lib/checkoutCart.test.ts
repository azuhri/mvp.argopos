import { describe, expect, it } from "vitest";
import { buildCheckoutCart, type CheckoutCatalogStock } from "./checkoutCart";
import type { CartItem } from "./storefront";

const missingId = "64133324-5e98-4dcc-b3e1-905d82d285e3";
const validId = "d3529f87-99a0-4bdf-9b81-fc06982127c7";
const stored: CartItem[] = [
  { productId: missingId, qty: 1, productName: "Produk lama", productPrice: 50000, productStock: 999 },
  { productId: validId, qty: 3, productName: "Nama tersimpan", productPrice: 1000, productStock: 1 },
];
const catalog: CheckoutCatalogStock[] = [{ id: validId, base_price: 20000, discount_price: 15000, tax_percentage: 11, stock: 100, master_product: { product_name: "Produk saat ini", image_path: "uploads/product.png" } }];

describe("checkout cart catalog reconciliation", () => {
  it("retains a missing stock visibly, blocks checkout and never drops or remaps its ID", () => {
    const before = structuredClone(stored);
    const result = buildCheckoutCart(stored, catalog);
    expect(result.items.map((item) => item.productId)).toEqual([missingId, validId]);
    expect(result.unavailableItems.map((item) => item.productId)).toEqual([missingId]);
    expect(result.items[0].issue).toContain("Produk tidak tersedia");
    expect(result.isReady).toBe(false);
    expect(stored).toEqual(before);
  });

  it("uses current prices, tax, stock and name while preserving the selected quantity", () => {
    const result = buildCheckoutCart(stored.slice(1), catalog, "https://assets.example.test");
    expect(result.isReady).toBe(true);
    expect(result.items[0]).toMatchObject({ productId: validId, qty: 3, productName: "Produk saat ini", productPrice: 16650, productStock: 100 });
    expect(result.items[0].product.image_url).toBe("https://assets.example.test/uploads/product.png");
    expect(result.total).toBe(49950);
  });

  it("does not classify rows for removal before a successful catalog response", () => {
    const result = buildCheckoutCart(stored);
    expect(result.isReady).toBe(false);
    expect(result.unavailableItems).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(buildCheckoutCart(stored, []).unavailableItems).toHaveLength(2);
  });

  it("blocks disabled and insufficient stock without silently changing quantity", () => {
    expect(buildCheckoutCart(stored.slice(1), [{ ...catalog[0], status: false }]).unavailableItems).toHaveLength(1);
    const result = buildCheckoutCart(stored.slice(1), [{ ...catalog[0], stock: 2 }]);
    expect(result.isReady).toBe(false);
    expect(result.unavailableItems).toHaveLength(0);
    expect(result.items[0].qty).toBe(3);
    expect(result.items[0].issue).toContain("Stok saat ini 2");
  });
});
