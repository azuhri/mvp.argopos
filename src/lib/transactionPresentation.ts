import type { Transaction } from "./api";
import { getDokuPaymentMethodLabel } from "./dokuPaymentMethods";

type TransactionPayment = Pick<Transaction, "payment_provider" | "doku_payment_method" | "payment_type">;

export function getTransactionPaymentMethodLabel(transaction: TransactionPayment): string {
  const provider = transaction.payment_provider?.trim().toUpperCase();
  const paymentType = transaction.payment_type?.trim() || "";
  if (provider === "DOKU" || (!provider && paymentType.toUpperCase() === "DOKU")) {
    const method = transaction.doku_payment_method?.trim().toUpperCase();
    if (!method) return "DOKU";
    const label = getDokuPaymentMethodLabel(method).replace(/^Virtual Account (?:BANK )?/, "VA ");
    return `DOKU - ${label}`;
  }

  const manualLabels: Record<string, string> = {
    qris: "QRIS",
    cash: "Tunai",
    transfer_rekening: "Transfer Bank",
    cutoff_hutang: "Cutoff/Hutang",
  };
  return manualLabels[paymentType] || paymentType || "-";
}

interface TransactionCartQuantity {
  qty?: number | null;
}

export function getTransactionItemCount(
  reportedTotal: unknown,
  carts: readonly TransactionCartQuantity[] = [],
): number {
  const cartTotal = carts.reduce((total, cart) => {
    const quantity = Number(cart.qty);
    return Number.isFinite(quantity) && quantity > 0
      ? total + Math.trunc(quantity)
      : total;
  }, 0);

  if (cartTotal > 0) return cartTotal;

  const normalizedReportedTotal = Number(reportedTotal);
  return Number.isFinite(normalizedReportedTotal) && normalizedReportedTotal > 0
    ? Math.trunc(normalizedReportedTotal)
    : 0;
}
