import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, type StoreDetailResponse } from "@/lib/api";
import { StoreService } from "./storeService";

afterEach(() => vi.restoreAllMocks());

const store: StoreDetailResponse = {
  location_id: "store-1",
  location_name: "Toko Test",
  location_code: "TEST",
  total_revenue: 5000,
  total_transactions: 1,
  total_stock: 0,
};

describe("StoreService.getStoreDetail", () => {
  it.each([null, undefined])("normalizes %s relations without mutating the API response", async (collection) => {
    const data: StoreDetailResponse = {
      ...store,
      assigned_users: collection,
      product_stores: collection,
      payment_methods: collection,
      transactions: collection,
    };
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({ success: true, data });

    const result = await new StoreService().getStoreDetail("store-1");

    expect(result).toEqual({ ...store, assigned_users: [], product_stores: [], payment_methods: [], transactions: [] });
    expect(data.assigned_users).toBe(collection);
    expect(result).not.toBe(data);
  });

  it("preserves populated relations and store metadata", async () => {
    const data: StoreDetailResponse = {
      ...store,
      assigned_users: [{ id: "user-1", username: "Staff", email: "staff@example.test", no_wa: "" }],
      product_stores: [],
      payment_methods: [],
      transactions: [{ id: "trx-1", status: "PAID", total_amount: 5000, total_item: 1, created_at: "2026-11-04T00:00:00Z" }],
    };
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({ success: true, data });

    expect(await new StoreService().getStoreDetail("store-1")).toEqual(data);
  });

  it("still rejects unsuccessful responses instead of displaying an empty store", async () => {
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({ success: false, message: "Forbidden" });

    await expect(new StoreService().getStoreDetail("store-1")).rejects.toThrow("Forbidden");
  });

  it("still rejects a missing store", async () => {
    vi.spyOn(apiClient, "getStoreDetail").mockResolvedValue({ success: true, data: null });

    await expect(new StoreService().getStoreDetail("store-1")).rejects.toThrow("Failed to get store detail");
  });
});
