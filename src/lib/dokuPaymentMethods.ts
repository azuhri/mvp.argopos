export function getDokuPaymentMethodLabel(method: string): string {
  if (method === "QRIS") return "QRIS";
  if (method === "CREDIT_CARD") return "Kartu kredit";
  if (method.startsWith("VIRTUAL_ACCOUNT_")) {
    const bank = method.slice("VIRTUAL_ACCOUNT_".length);
    const bankLabels: Record<string, string> = { BANK_MANDIRI: "Mandiri", BANK_SYARIAH_MANDIRI: "BSI" };
    return `Virtual Account ${bankLabels[bank] || bank.replace(/_/g, " ")}`;
  }
  return method.replace(/_/g, " ");
}
