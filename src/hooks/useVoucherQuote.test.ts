import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { voucherService } from "@/lib/services/voucherService";
import type { VoucherQuote } from "@/lib/voucherTypes";
import { useVoucherQuote } from "./useVoucherQuote";

const quote: VoucherQuote = { voucher_code: "HEMAT20", discount_type: "FIXED", discount_value: 20000, base_amount: 50000, discount_amount: 20000, payable_amount: 30000, expires_at: null, requires_settlement: true };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("checkout voucher validation", () => {
  it("blocks quote requests for an invalid cart and ignores an in-flight quote when availability changes", async () => {
    let resolve!: (value: VoucherQuote) => void;
    const request = vi.spyOn(voucherService, "quote").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ enabled }) => useVoucherQuote("store", [{ product_stock_id: "stock", qty: 1 }], 50000, enabled), { initialProps: { enabled: false } });
    act(() => result.current.changeCode("HEMAT20"));
    await act(async () => result.current.apply());
    expect(request).not.toHaveBeenCalled();
    rerender({ enabled: true });
    let pending!: Promise<void>;
    act(() => { pending = result.current.apply(); });
    rerender({ enabled: false });
    await act(async () => { resolve(quote); await pending; });
    expect(result.current.quote).toBeUndefined();
    expect(result.current.pending).toBe(false);
    expect(result.current.needsValidation).toBe(true);
  });

  it("invalidates the applied discount when the cart or store changes", async () => {
    const request = vi.spyOn(voucherService, "quote").mockResolvedValue(quote);
    const { result, rerender } = renderHook(({ store, qty }) => useVoucherQuote(store, [{ product_stock_id: "stock", qty }], qty * 50000), { initialProps: { store: "store-1", qty: 1 } });
    act(() => result.current.changeCode("hemat20"));
    await act(async () => result.current.apply());
    expect(request).toHaveBeenCalledWith("store-1", "HEMAT20", [{ product_stock_id: "stock", qty: 1 }]);
    expect(result.current.quote?.payable_amount).toBe(30000);
    expect(result.current.needsValidation).toBe(false);
    rerender({ store: "store-1", qty: 2 });
    expect(result.current.quote).toBeUndefined();
    expect(result.current.needsValidation).toBe(true);
    await act(async () => result.current.apply());
    rerender({ store: "store-2", qty: 2 });
    expect(result.current.quote).toBeUndefined();
  });

  it("ignores a late quote after editing the code or cart", async () => {
    let resolve!: (value: VoucherQuote) => void;
    vi.spyOn(voucherService, "quote").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ qty }) => useVoucherQuote("store", [{ product_stock_id: "stock", qty }], qty * 50000), { initialProps: { qty: 1 } });
    act(() => result.current.changeCode("HEMAT20"));
    let request!: Promise<void>;
    act(() => { request = result.current.apply(); });
    expect(result.current.pending).toBe(true);
    rerender({ qty: 2 });
    await act(async () => { resolve(quote); await request; });
    expect(result.current.quote).toBeUndefined();
    act(() => { request = result.current.apply(); });
    act(() => result.current.changeCode("OTHER"));
    await act(async () => { resolve(quote); await request; });
    expect(result.current.quote).toBeUndefined();
    expect(result.current.code).toBe("OTHER");
    expect(result.current.pending).toBe(false);
  });

  it("keeps invalid, expired, or failed vouchers from authorizing checkout", async () => {
    const request = vi.spyOn(voucherService, "quote").mockRejectedValue(new Error("Voucher telah kedaluwarsa"));
    const { result } = renderHook(() => useVoucherQuote("store", [{ product_stock_id: "stock", qty: 1 }], 50000));
    act(() => result.current.changeCode("INVALID CODE"));
    await act(async () => result.current.apply());
    expect(request).not.toHaveBeenCalled();
    expect(result.current.needsValidation).toBe(true);
    act(() => result.current.changeCode("HEMAT20"));
    await act(async () => result.current.apply());
    expect(result.current.error).toBe("Voucher telah kedaluwarsa");
    request.mockResolvedValue({ ...quote, expires_at: "2000-01-01T00:00:00Z" });
    await act(async () => result.current.apply());
    expect(result.current.needsValidation).toBe(true);
    expect(result.current.quote).toBeUndefined();
    act(() => result.current.changeCode(""));
    expect(result.current.needsValidation).toBe(false);
  });
});
