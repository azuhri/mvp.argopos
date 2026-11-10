import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("commerce confirmation storage", () => {
  it("does not treat the remembered location as an explicit session confirmation", async () => {
    const location = await import("./commerceLocation");
    localStorage.setItem(location.COMMERCE_LOCATION_PREFERENCE_KEY, "A");
    expect(location.getConfirmedCommerceLocation()).toBe("");
    expect(location.getPreferredCommerceLocation()).toBe("A");
  });
  it("preserves shared owner and cart when its setter fails but getters still work", async () => {
    const location = await import("./commerceLocation");
    localStorage.setItem(location.COMMERCE_LOCATION_PREFERENCE_KEY, "A");
    sessionStorage.setItem(location.COMMERCE_LOCATION_CONFIRMATION_KEY, "A");
    const cart = JSON.stringify([{ productId: "stock-A", qty: 1 }]);
    localStorage.setItem("argopos.store.cart", cart);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    expect(() => location.confirmCommerceLocation("B")).toThrow("Lokasi belum dapat disimpan");
    expect(location.getConfirmedCommerceLocation()).toBe("A");
    expect(location.getPreferredCommerceLocation()).toBe("A");
    expect(localStorage.getItem("argopos.store.cart")).toBe(cart);
    expect(localStorage.getItem(location.COMMERCE_LOCATION_PREFERENCE_KEY)).toBe("A");
    expect(sessionStorage.getItem(location.COMMERCE_LOCATION_CONFIRMATION_KEY)).toBe("A");
  });
  it("supports a tab-local confirmation fallback while observing real shared owner changes", async () => {
    const location = await import("./commerceLocation");
    localStorage.setItem(location.COMMERCE_LOCATION_PREFERENCE_KEY, "B");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    location.confirmCommerceLocation("B");
    expect(location.getPreferredCommerceLocation()).toBe("B");
    expect(location.getConfirmedCommerceLocation()).toBe("B");
    write.mockRestore();
    localStorage.setItem(location.COMMERCE_LOCATION_PREFERENCE_KEY, "C");
    expect(location.getPreferredCommerceLocation()).toBe("C");
    expect(location.getConfirmedCommerceLocation()).toBe("B");
  });
  it("forgets persisted confirmation when session storage is cleared", async () => {
    const location = await import("./commerceLocation");
    location.confirmCommerceLocation("A"); sessionStorage.clear();
    expect(location.getConfirmedCommerceLocation()).toBe("");
  });
  it("fails closed when shared storage cannot be read", async () => {
    const location = await import("./commerceLocation");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(() => location.confirmCommerceLocation("A")).toThrow("Lokasi belum dapat disimpan");
    expect(location.getConfirmedCommerceLocation()).toBe("");
    expect(location.getPreferredCommerceLocation()).toBe("");
  });
  it("requires confirmation before clearing a foreign cart and preserves history", async () => {
    const location = await import("./commerceLocation");
    localStorage.setItem(location.COMMERCE_LOCATION_PREFERENCE_KEY, "A");
    const cart = JSON.stringify([{ productId: "stock-A", qty: 1 }]);
    localStorage.setItem("argopos.store.cart", cart); localStorage.setItem("argopos.store.pending-payments.v1", "history");
    expect(location.commerceCartNeedsReset("B")).toBe(true);
    expect(localStorage.getItem("argopos.store.cart")).toBe(cart);
    location.confirmCommerceLocation("B");
    expect(localStorage.getItem("argopos.store.cart")).toBeNull();
    expect(localStorage.getItem("argopos.store.pending-payments.v1")).toBe("history");
  });
  it("restores the shared owner and does not confirm when clearing the old cart fails", async () => {
    const location = await import("./commerceLocation");
    localStorage.setItem(location.COMMERCE_LOCATION_PREFERENCE_KEY, "A");
    const cart = JSON.stringify([{ productId: "stock-A", qty: 1 }]);
    localStorage.setItem("argopos.store.cart", cart);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(() => location.confirmCommerceLocation("B")).toThrow("Keranjang belum dapat diperbarui");
    expect(location.getPreferredCommerceLocation()).toBe("A");
    expect(location.getConfirmedCommerceLocation()).toBe("");
    expect(localStorage.getItem("argopos.store.cart")).toBe(cart);
  });
});
