import { describe, expect, it } from "vitest";
import { getTransactionItemCount, getTransactionPaymentMethodLabel } from "./transactionPresentation";

describe("getTransactionPaymentMethodLabel", () => {
  it.each([
    ["VIRTUAL_ACCOUNT_BCA", "DOKU - VA BCA"],
    ["VIRTUAL_ACCOUNT_BNI", "DOKU - VA BNI"],
    ["VIRTUAL_ACCOUNT_BANK_MANDIRI", "DOKU - VA Mandiri"],
    ["VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI", "DOKU - VA BSI"],
    ["VIRTUAL_ACCOUNT_DOKU", "DOKU - VA DOKU"],
    ["VIRTUAL_ACCOUNT_BRI", "DOKU - VA BRI"],
    ["VIRTUAL_ACCOUNT_BANK_PERMATA", "DOKU - VA PERMATA"],
    ["VIRTUAL_ACCOUNT_BANK_CIMB", "DOKU - VA CIMB"],
    ["VIRTUAL_ACCOUNT_BANK_DANAMON", "DOKU - VA DANAMON"],
    ["VIRTUAL_ACCOUNT_BNC", "DOKU - VA BNC"],
    ["VIRTUAL_ACCOUNT_BTN", "DOKU - VA BTN"],
    ["VIRTUAL_ACCOUNT_MAYBANK", "DOKU - VA MAYBANK"],
    ["VIRTUAL_ACCOUNT_SINARMAS", "DOKU - VA SINARMAS"],
    ["QRIS", "DOKU - QRIS"],
    ["CREDIT_CARD", "DOKU - Kartu kredit"],
    ["NEW_METHOD", "DOKU - NEW METHOD"],
  ])("shows the stored DOKU method %s", (method, expected) => {
    expect(getTransactionPaymentMethodLabel({ payment_provider: "DOKU", doku_payment_method: method })).toBe(expected);
  });

  it("prefers the DOKU snapshot over a legacy manual payment type", () => {
    expect(getTransactionPaymentMethodLabel({ payment_provider: "DOKU", doku_payment_method: "VIRTUAL_ACCOUNT_BCA", payment_type: "transfer_rekening" })).toBe("DOKU - VA BCA");
  });

  it("does not invent a bank when an old DOKU order has no selection", () => {
    expect(getTransactionPaymentMethodLabel({ payment_provider: "DOKU" })).toBe("DOKU");
    expect(getTransactionPaymentMethodLabel({ payment_type: "DOKU", doku_payment_method: " " })).toBe("DOKU");
  });

  it("normalizes whitespace and supports the legacy DOKU payment type", () => {
    expect(getTransactionPaymentMethodLabel({ payment_type: "DOKU", doku_payment_method: " virtual_account_bca " })).toBe("DOKU - VA BCA");
  });

  it.each([
    ["qris", "QRIS"],
    ["cash", "Tunai"],
    ["transfer_rekening", "Transfer Bank"],
    ["cutoff_hutang", "Cutoff/Hutang"],
    [undefined, "-"],
  ])("preserves the manual method %s", (paymentType, expected) => {
    expect(getTransactionPaymentMethodLabel({ payment_provider: "MANUAL", payment_type: paymentType, doku_payment_method: "VIRTUAL_ACCOUNT_BCA" })).toBe(expected);
  });
});

describe("getTransactionItemCount", () => {
  it("uses cart quantities when the persisted aggregate is zero", () => {
    expect(getTransactionItemCount(0, [{ qty: 2 }, { qty: 1 }])).toBe(3);
  });

  it("prefers cart quantities over a stale aggregate", () => {
    expect(getTransactionItemCount(9, [{ qty: 2 }, { qty: 1 }])).toBe(3);
  });

  it("falls back to a valid aggregate when carts are unavailable", () => {
    expect(getTransactionItemCount(4)).toBe(4);
  });

  it("normalizes malformed quantities to zero", () => {
    expect(getTransactionItemCount(undefined, [{ qty: -1 }, { qty: Number.NaN }])).toBe(0);
  });
});
