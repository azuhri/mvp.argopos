import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentSuccess from "./PaymentSuccess";

const mocks = vi.hoisted(() => ({ removePendingPayment: vi.fn() }));
vi.mock("@/lib/pendingPaymentStorage", () => mocks);
vi.mock("@/components/layout/AppLayoutCommerce", () => ({ AppLayoutCommerce: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function renderStatus(status: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { id: "order-one", transaction_code: "TRX-ONE", status, total_amount: 50000, base_amount: 50000, total_item: 1, payment_provider: "DOKU", transaction_carts: [] } }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/STORE/commerce/payment-success/order-one?status=SUCCESS"]}><Routes><Route path="/:locationCode/commerce/payment-success/:transactionId" element={<PaymentSuccess />} /><Route path="/:locationCode/commerce/payment/:transactionId" element={<p>Detail pembayaran canonical</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("verified completion", () => {
  it("returns an unpaid direct success visit to details and preserves recovery", async () => {
    renderStatus("WAITING_TO_PAYMENT");
    expect(await screen.findByText("Detail pembayaran canonical")).toBeInTheDocument();
    expect(mocks.removePendingPayment).not.toHaveBeenCalled();
    expect(screen.queryByText("Transaksi berhasil diselesaikan")).not.toBeInTheDocument();
  });
  it("only claims receipt completion when the backend confirms COMPLETED", async () => {
    renderStatus("COMPLETED");
    expect(await screen.findByText("Transaksi berhasil diselesaikan")).toBeInTheDocument();
    expect(mocks.removePendingPayment).toHaveBeenCalledWith("order-one");
    expect(screen.queryByText("Kode unik")).not.toBeInTheDocument();
  });
});
