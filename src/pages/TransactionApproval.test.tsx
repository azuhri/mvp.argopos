import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionApproval from "./TransactionApproval";

const mocks = vi.hoisted(() => ({
  getTransaction: vi.fn(),
  approveTransactionPayment: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getTransaction: mocks.getTransaction,
    approveTransactionPayment: mocks.approveTransactionPayment,
  },
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const waitingTransaction = {
  id: "transaction-id",
  transaction_code: "TRX-001",
  customer_name: "Customer Test",
  location_name: "Store Bandung",
  status: "WAITING_TO_PAYMENT",
  total_amount: 50000,
  total_item: 1,
  created_at: "2026-08-07T08:00:00Z",
};

const renderPage = () => render(
  <MemoryRouter initialEntries={["/transactions/transaction-id/approve-payment"]}>
    <Routes>
      <Route path="/transactions/:transactionId/approve-payment" element={<TransactionApproval />} />
    </Routes>
  </MemoryRouter>,
);

describe("TransactionApproval", () => {
  beforeEach(() => {
    mocks.getTransaction.mockReset();
    mocks.approveTransactionPayment.mockReset();
  });

  it("does not approve a payment merely by opening the email link", async () => {
    mocks.getTransaction.mockResolvedValue({ success: true, data: waitingTransaction });
    mocks.approveTransactionPayment.mockResolvedValue({ success: true });

    renderPage();

    expect(await screen.findByText("TRX-001")).toBeInTheDocument();
    expect(mocks.approveTransactionPayment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi pembayaran" }));

    await waitFor(() => {
      expect(mocks.approveTransactionPayment).toHaveBeenCalledWith("transaction-id");
      expect(screen.getByText("Pembayaran sudah dikonfirmasi")).toBeInTheDocument();
    });
  });

  it("shows an already-paid transaction without another approval action", async () => {
    mocks.getTransaction.mockResolvedValue({
      success: true,
      data: { ...waitingTransaction, status: "PAID" },
    });

    renderPage();

    expect(await screen.findByText("Pembayaran sudah dikonfirmasi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Konfirmasi pembayaran" })).not.toBeInTheDocument();
    expect(mocks.approveTransactionPayment).not.toHaveBeenCalled();
  });

  it("does not offer manual payment approval for a gateway order", async () => {
    mocks.getTransaction.mockResolvedValue({ success: true, data: { ...waitingTransaction, payment_provider: "DOKU" } });
    renderPage();
    expect(await screen.findByText(/Pembayaran DOKU diverifikasi otomatis/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Konfirmasi pembayaran" })).not.toBeInTheDocument();
    expect(mocks.approveTransactionPayment).not.toHaveBeenCalled();
  });
});
