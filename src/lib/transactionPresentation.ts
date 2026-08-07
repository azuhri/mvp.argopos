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
