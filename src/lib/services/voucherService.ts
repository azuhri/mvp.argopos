import { apiClient } from "@/lib/api";
import type { StoreVoucherInput, VoucherCartLine } from "@/lib/voucherTypes";

export const voucherService = {
  async list(locationId: string, page = 1) {
    const response = await apiClient.listStoreVouchers(locationId, page, 20);
    if (!response.success) throw new Error(response.message || "Voucher belum dapat dimuat");
    return { items: response.data ?? [], total: response.meta?.total ?? response.data?.length ?? 0 };
  },
  async save(locationId: string, input: StoreVoucherInput, voucherId?: string) {
    const response = await apiClient.saveStoreVoucher(locationId, input, voucherId);
    if (!response.success || !response.data) throw new Error(response.message || "Voucher belum tersimpan");
    return response.data;
  },
  async usage(locationId: string, params: { voucher_id?: string; settlement_status?: string; page: number; page_size: number }) {
    const response = await apiClient.listVoucherTransactions(locationId, params);
    if (!response.success) throw new Error(response.message || "Penggunaan voucher belum dapat dimuat");
    return { items: response.data ?? [], total: response.meta?.total ?? 0 };
  },
  async settle(locationId: string, transactionId: string) {
    const response = await apiClient.settleVoucherTransaction(locationId, transactionId);
    if (!response.success || !response.data) throw new Error(response.message || "Settlement belum tersimpan");
    return response.data;
  },
  async quote(locationId: string, code: string, carts: VoucherCartLine[]) {
    const response = await apiClient.quoteStoreVoucher(locationId, code, carts);
    if (!response.success || !response.data) throw new Error(response.message || "Voucher tidak dapat digunakan");
    return response.data;
  },
};
