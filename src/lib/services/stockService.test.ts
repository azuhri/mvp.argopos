import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiClient,
  type StockMutationFilters,
  type StockMutationListResponse,
  type StockTransferRequestFilters,
  type StockTransferRequestListResponse,
} from "@/lib/api";
import { stockService } from "./stockService";

describe("StockService stock mutations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads paginated mutations through the API client", async () => {
    const filters: StockMutationFilters = {
      page: 2,
      page_size: 20,
      movement_type: "checkout",
      sort_order: "desc",
    };
    const data: StockMutationListResponse = {
      mutations: [],
      meta: { page: 2, page_size: 20, total: 0, total_pages: 1 },
    };
    const getStockMutations = vi
      .spyOn(apiClient, "getStockMutations")
      .mockResolvedValue({ success: true, data });

    await expect(stockService.getStockMutations(filters)).resolves.toEqual(data);
    expect(getStockMutations).toHaveBeenCalledWith(filters);
  });

  it("scopes store requests to both directions through location_id", async () => {
    const filters: StockTransferRequestFilters = {
      page: 1,
      page_size: 10,
      location_id: "store-id",
      movement_type: "all",
      status: "all",
      sort_order: "desc",
    };
    const data: StockTransferRequestListResponse = {
      requests: [],
      meta: { page: 1, page_size: 10, total: 0, total_pages: 1 },
    };
    const getStockTransferRequests = vi
      .spyOn(apiClient, "getStockTransferRequests")
      .mockResolvedValue({ success: true, data });

    await expect(stockService.getStockTransferRequests(filters)).resolves.toEqual(data);
    expect(getStockTransferRequests).toHaveBeenCalledWith(filters);
  });

  it("loads an authenticated approval letter blob", async () => {
    const letter = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const getStockApprovalLetter = vi
      .spyOn(apiClient, "getStockApprovalLetter")
      .mockResolvedValue({ success: true, data: letter });

    await expect(stockService.getStockApprovalLetter("request-id", true)).resolves.toBe(letter);
    expect(getStockApprovalLetter).toHaveBeenCalledWith("request-id", true);
  });
});
