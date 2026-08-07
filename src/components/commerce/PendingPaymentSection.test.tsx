import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendingPaymentSection } from "./PendingPaymentSection";

const mocks = vi.hoisted(() => ({
  usePendingPayments: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("@/hooks/usePendingPayments", () => ({
  usePendingPayments: mocks.usePendingPayments,
}));

const payment = {
  transaction_id: "transaction-1",
  transaction_code: "TRX-001",
  location_code: "AMP-JKT",
  location_name: "AMP Mart Jakarta",
  total_amount: 57_042,
  status: "WAITING_TO_PAYMENT",
  created_at: "2098-08-06T07:00:00.000Z",
  expires_at: "2099-08-06T13:00:00.000Z",
};

describe("PendingPaymentSection", () => {
  beforeEach(() => {
    mocks.retry.mockReset();
    mocks.usePendingPayments.mockReturnValue({
      payments: [payment],
      isLoading: false,
      hasReconcileError: false,
      retry: mocks.retry,
    });
  });

  it("renders verified payment metadata and links to the original transaction", () => {
    render(
      <MemoryRouter>
        <PendingPaymentSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Pembayaran tertunda" })).toBeInTheDocument();
    expect(screen.getByText("TRX-001")).toBeInTheDocument();
    expect(screen.getByText("AMP Mart Jakarta")).toBeInTheDocument();
    expect(screen.getByText("Menunggu pembayaran")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lanjutkan pembayaran/i })).toHaveAttribute(
      "href",
      "/AMP-JKT/commerce/payment/transaction-1",
    );
  });

  it("passes the current location to scoped catalog reconciliation", () => {
    render(
      <MemoryRouter>
        <PendingPaymentSection locationCode="AMP-JKT" />
      </MemoryRouter>,
    );

    expect(mocks.usePendingPayments).toHaveBeenCalledWith("AMP-JKT");
  });

  it("does not render an empty successful section", () => {
    mocks.usePendingPayments.mockReturnValue({
      payments: [],
      isLoading: false,
      hasReconcileError: false,
      retry: mocks.retry,
    });

    const { container } = render(
      <MemoryRouter>
        <PendingPaymentSection />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a non-blocking retry state without presenting an unverified card", () => {
    mocks.usePendingPayments.mockReturnValue({
      payments: [],
      isLoading: false,
      hasReconcileError: true,
      retry: mocks.retry,
    });

    render(
      <MemoryRouter>
        <PendingPaymentSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Katalog tetap dapat digunakan");
    expect(screen.queryByRole("link", { name: /Lanjutkan pembayaran/i })).not.toBeInTheDocument();
  });
});
