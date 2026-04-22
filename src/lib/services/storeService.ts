import { apiClient } from "@/lib/api";
import type {
  StoreMetrics,
  StoreStockList,
  ApiResponse,
  Store,
  StoreAssignedUser,
  Transaction,
  StorePaymentMethod,
} from "@/lib/api";

export class StoreService {
  async getStoreMetrics(locationId: string): Promise<StoreMetrics> {
    const response = await apiClient.getStoreMetrics(locationId);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get store metrics");
    }

    return response.data;
  }

  async getAllStoresMetrics(): Promise<StoreMetrics[]> {
    const response = await apiClient.getAllStoresMetrics();

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get all stores metrics");
    }

    return response.data;
  }

  async getStoreStocks(locationId: string): Promise<StoreStockList> {
    const response = await apiClient.getStoreStocks(locationId);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get store stocks");
    }

    return response.data;
  }

  async getAllStoresStocks(): Promise<StoreStockList[]> {
    const response = await apiClient.getAllStoresStocks();

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get all stores stocks");
    }

    return response.data;
  }

  async getStoreDetail(locationId: string): Promise<Store> {
    const response = await apiClient.getStoreDetail(locationId);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get store detail");
    }

    return response.data;
  }

  async getStoreAssignedUsers(locationId: string): Promise<StoreAssignedUser[]> {
    const response = await apiClient.getStoreAssignedUsers(locationId);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get assigned users");
    }

    return response.data;
  }

  async getStoreTransactions(
    locationId: string,
    params?: {
      status?: string;
      user_id?: string;
      start_date?: string;
      end_date?: string;
      payment_method?: string;
      sort_by?: string;
      sort_order?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const response = await apiClient.getStoreTransactions(locationId, params);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get transactions");
    }

    return {
      transactions: response.data,
      total: response.meta?.total || 0,
    };
  }

  async getStorePaymentMethods(locationId: string): Promise<StorePaymentMethod[]> {
    const response = await apiClient.getStorePaymentMethods(locationId);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to get payment methods");
    }

    return response.data;
  }

  async upsertPaymentMethod(paymentMethod: any): Promise<void> {
    const response = await apiClient.upsertPaymentMethod(paymentMethod);

    if (!response.success) {
      throw new Error(response.message || "Failed to save payment method");
    }
  }

  async deletePaymentMethod(id: string): Promise<void> {
    const response = await apiClient.deletePaymentMethod(id);

    if (!response.success) {
      throw new Error(response.message || "Failed to delete payment method");
    }
  }
}

export const storeService = new StoreService();
