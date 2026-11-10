export type VoucherDiscountType = "FIXED" | "PERCENTAGE";
export type VoucherSettlementStatus = "UNSETTLED" | "SETTLED";
export interface VoucherTransactionFields {
  voucher_id?: string;
  voucher_code?: string;
  voucher_discount_type?: VoucherDiscountType;
  voucher_discount_value?: number;
  discount_amount?: number;
  voucher_settlement_required?: boolean;
  voucher_settlement_status?: VoucherSettlementStatus | null;
  voucher_settled_by?: string | null;
  voucher_settled_at?: string | null;
}
export interface StoreVoucher {
  id: string;
  location_id: string;
  code: string;
  discount_type: VoucherDiscountType;
  discount_value: number;
  expires_at: string | null;
  is_active: boolean;
  requires_settlement: boolean;
  created_by: string;
  creator_name?: string;
  created_at: string;
}
export type StoreVoucherInput = Pick<StoreVoucher, "code" | "discount_type" | "discount_value" | "expires_at" | "is_active" | "requires_settlement">;
export interface VoucherQuote {
  voucher_code: string;
  discount_type: VoucherDiscountType;
  discount_value: number;
  base_amount: number;
  discount_amount: number;
  payable_amount: number;
  expires_at: string | null;
  requires_settlement: boolean;
}
export interface VoucherCartLine { product_stock_id: string; qty: number }
export interface VoucherUsage extends VoucherTransactionFields {
  id?: string;
  transaction_id?: string;
  transaction_code: string;
  customer_name?: string;
  status: string;
  paid_at?: string | null;
  base_amount: number;
  total_amount: number;
  created_at: string;
  settled_by_name?: string;
}
