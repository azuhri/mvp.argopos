import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentSession } from "@/lib/services/paymentService";
import PaymentDetail from "./PaymentDetail";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(), refreshStatus: vi.fn(), createCheckout: vi.fn(), removePendingPayment: vi.fn(),
  readPendingPayments: vi.fn(() => []), upsertPendingPayment: vi.fn(() => true),
}));
vi.mock("@/lib/services/paymentService", async (original) => ({
  ...await original<typeof import("@/lib/services/paymentService")>(),
  paymentService: { getStatus: mocks.getStatus, refreshStatus: mocks.refreshStatus, createCheckout: mocks.createCheckout },
}));
vi.mock("@/lib/pendingPaymentStorage", () => mocks);
vi.mock("@/components/layout/AppLayoutCommerce", () => ({ AppLayoutCommerce: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

const clients: QueryClient[] = [];
let transactionStatus: string;
let paymentStatus: PaymentSession["status"];
let reviewRequired: boolean;
let transactionReads: number;
let provider: string;

beforeEach(() => {
  vi.clearAllMocks();
  transactionStatus = "WAITING_TO_PAYMENT";
  paymentStatus = "PENDING";
  reviewRequired = false;
  transactionReads = 0;
  provider = "DOKU";
  window.history.replaceState({}, "", "/?doku_return=1&status=SUCCESS");
  mocks.getStatus.mockImplementation(async (): Promise<PaymentSession> => ({
    payment_id: "attempt-one", transaction_id: "order-one", invoice_number: "CEL-TEST-ONE",
    status: paymentStatus, amount: 50000, expires_at: new Date(Date.now() + 3600000).toISOString(),
    verification_pending: paymentStatus === "PENDING", review_required: reviewRequired,
  }));
  mocks.refreshStatus.mockImplementation(async () => ({ session: await mocks.getStatus.getMockImplementation()!(), checked: true }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let data: unknown;
    if (url.endsWith("/STORE/store")) {
      data = { location_id: "store-one", location_code: "STORE", location_name: "Outlet Uji" };
    } else if (url.endsWith("/payment-methods") || url.endsWith("/assigned-users")) {
      data = [];
    } else if (url.endsWith("/transactions/order-one")) {
      transactionReads += 1;
      data = {
        id: "order-one", master_location_id: "store-one", transaction_code: "TRX-TEST-ONE",
        status: transactionStatus, payment_provider: provider, total_amount: 50000, base_amount: 50000,
        total_item: 1, transaction_carts: [], created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
    } else {
      throw new Error(`Unexpected test request: ${url}`);
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  }));
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

function renderDetail(search = "?doku_return=1&status=SUCCESS") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/STORE/commerce/payment/order-one${search}`]}><Routes><Route path="/:locationCode/commerce/payment/:transactionId" element={<PaymentDetail />} /><Route path="/:locationCode/commerce/payment-success/:transactionId" element={<p>Halaman pembayaran berhasil</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("DOKU payment status and transaction synchronization", () => {
  it("explains outstanding server confirmation without trusting a successful return URL", async () => {
    renderDetail();
    expect(await screen.findByText("Menunggu konfirmasi pembayaran DOKU. Jika sudah membayar, jangan bayar ulang.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Menunggu verifikasi pembayaran" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Periksa status pembayaran" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("payment-countdown")).not.toBeInTheDocument();
    expect(screen.getAllByText("Waiting Payment")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("immediately refreshes the parent transaction after the panel receives verified PAID", async () => {
    renderDetail("?view=order");
    expect(await screen.findAllByText("Waiting Payment")).toHaveLength(2);
    await screen.findByRole("button", { name: "Periksa status pembayaran" });
    expect(transactionReads).toBe(1);
    paymentStatus = "PAID";
    transactionStatus = "PAID";
    fireEvent.click(screen.getByRole("button", { name: "Periksa status pembayaran" }));
    expect(await screen.findByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    // Default waitFor timeout is below the five-second transaction polling interval.
    // This proves the PAID transition invalidates the still-fresh parent query.
    await waitFor(() => expect(screen.queryAllByText("Waiting Payment")).toHaveLength(0));
    expect(transactionReads).toBe(2);
    expect(screen.getAllByText("Paid")).toHaveLength(2);
    expect(screen.getByText("Pembayaran DOKU telah diterima. Periksa detail verifikasi di bawah.")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-countdown")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bayar nanti" })).not.toBeInTheDocument();
    expect(mocks.removePendingPayment).toHaveBeenCalledWith("order-one");
    expect(mocks.refreshStatus).toHaveBeenCalledWith("order-one");
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("keeps a late verified payment under review without promising order fulfillment", async () => {
    transactionStatus = "REJECTED";
    paymentStatus = "PAID";
    reviewRequired = true;
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Pembayaran perlu ditinjau" })).toBeInTheDocument();
    expect(screen.getByText(/Pembayaran telah diterima dan sedang diperiksa admin/)).toBeInTheDocument();
    expect(screen.getByText("Pesanan telah dibatalkan. Periksa status pembayaran DOKU di bawah sebelum membuat pesanan baru.")).toBeInTheDocument();
    expect(screen.queryByText(/pesanan segera diproses/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bayar melalui DOKU" })).not.toBeInTheDocument();
    expect(screen.queryByText("Halaman pembayaran berhasil")).not.toBeInTheDocument();
  });

  it.each(["?doku_return=1&status=FAILED", ""])("opens success only after owned PAID, independent of return parameters %s", async (search) => {
    paymentStatus = "PAID";
    renderDetail(search);
    expect(await screen.findByText("Halaman pembayaran berhasil")).toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("preserves the manual payment instructions without starting gateway polling", async () => {
    provider = "MANUAL";
    renderDetail();
    expect(await screen.findByText("Selesaikan pembayaran sebelum waktu berakhir.")).toBeInTheDocument();
    expect(screen.getByText("Status diperbarui otomatis setiap 5 detik.")).toBeInTheDocument();
    expect(screen.getByTestId("payment-countdown")).toBeInTheDocument();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.refreshStatus).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });
});
