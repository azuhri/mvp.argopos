import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/mockData";
import type { VoucherTransactionFields } from "@/lib/voucherTypes";

export function VoucherTransactionBadge({ transaction }: { transaction: VoucherTransactionFields }) {
  if (!transaction.voucher_code) return null;
  return <div className="mt-2 flex max-w-full flex-wrap gap-1 text-xs" aria-label="Voucher transaksi">
    <Badge variant="outline" className="max-w-full break-all font-mono">{transaction.voucher_code}</Badge>
    <span className="self-center text-emerald-700">−{formatCurrency(transaction.discount_amount ?? 0)}</span>
    {transaction.voucher_settlement_required && <Badge variant={transaction.voucher_settlement_status === "SETTLED" ? "secondary" : "outline"}>{transaction.voucher_settlement_status ?? "UNSETTLED"}</Badge>}
  </div>;
}
