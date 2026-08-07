import { describe, expect, it } from "vitest";
import { getTransactionItemCount } from "./transactionPresentation";

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
