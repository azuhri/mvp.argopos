import { apiClient } from "@/lib/api";

export interface PickupQrConfirmation {
  transaction_id: string;
  transaction_code: string;
  status: "COMPLETED";
  already_completed: boolean;
}

export const pickupQrService = {
  async confirm(qrPayload: string): Promise<PickupQrConfirmation> {
    const response = await apiClient.confirmPickupQr(qrPayload);
    if (!response.success || !response.data || response.data.status !== "COMPLETED") {
      throw new Error(response.message || "Konfirmasi penyerahan belum berhasil. Silakan pindai ulang QR.");
    }
    return response.data;
  },
};
