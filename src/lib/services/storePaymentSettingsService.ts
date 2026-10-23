import { apiClient, type StorePaymentMode, type StorePaymentSettings } from "@/lib/api";

export type { StorePaymentMode, StorePaymentSettings } from "@/lib/api";

export const storePaymentSettingsQueryKey = (locationId: string) => ["store-payment-settings", locationId] as const;

function checkedSettings(data: StorePaymentSettings | undefined, locationId: string): StorePaymentSettings {
  if (!data || data.location_id !== locationId ||
      !["MANUAL", "DOKU"].includes(data.payment_mode) || typeof data.doku_available !== "boolean") {
    throw new Error("Pengaturan pembayaran toko belum dapat dimuat. Silakan coba lagi.");
  }
  return { ...data, doku_methods: Array.isArray(data.doku_methods) ? data.doku_methods : [] };
}

export async function getStorePaymentSettings(locationId: string): Promise<StorePaymentSettings> {
  const response = await apiClient.getStorePaymentSettings(locationId);
  if (!response.success) throw new Error("Pengaturan pembayaran toko belum dapat dimuat. Silakan coba lagi.");
  return checkedSettings(response.data, locationId);
}

export async function updateStorePaymentSettings(locationId: string, mode: StorePaymentMode): Promise<StorePaymentSettings> {
  const response = await apiClient.updateStorePaymentSettings(locationId, mode);
  if (!response.success) throw new Error("Mode pembayaran belum tersimpan. Periksa akses Anda lalu coba lagi.");
  return checkedSettings(response.data, locationId);
}
