import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOKU_MAINTENANCE_MESSAGE, PaymentRequestError, type PaymentSession } from "@/lib/services/paymentService";
import PaymentMaintenance from "./PaymentMaintenance";

const mocks = vi.hoisted(() => ({ getStatus: vi.fn(), refreshStatus: vi.fn(), createCheckout: vi.fn(), openCheckout: vi.fn() }));
vi.mock("@/lib/services/paymentService", async (original) => ({
  ...await original<typeof import("@/lib/services/paymentService")>(), paymentService: mocks, openDokuCheckout: mocks.openCheckout,
}));
vi.mock("@/components/layout/AppLayoutCommerce", () => ({ AppLayoutCommerce: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

const failed: PaymentSession = {
  transaction_id: "order-one", transaction_status: "FAILED", payment_id: "attempt-one", invoice_number: "CEL-ONE", amount: 50000,
  status: "FAILED", creation_state: "REJECTED", verification_pending: false, can_retry_checkout: true,
  expires_at: new Date(Date.now() + 3600000).toISOString(), checkout_retry_expires_at: new Date(Date.now() + 3600000).toISOString(),
};
const clients: QueryClient[] = [];
function renderMaintenance(withOrder = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/STORE/commerce/payment-maintenance${withOrder ? "/order-one" : ""}`]}><Routes>
    <Route path="/:locationCode/commerce/payment-maintenance/:transactionId?" element={<PaymentMaintenance />} />
    <Route path="/:locationCode/commerce/payment-success/:transactionId" element={<p>Halaman sukses terverifikasi</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.getStatus.mockResolvedValue(failed); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); });

describe("dedicated payment maintenance page", () => {
  it("shows only the maintenance message and safe recovery actions, including after a fresh visit", async () => {
    renderMaintenance();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled());
    expect(screen.getByRole("heading", { level: 1, name: "Pembayaran sedang maintenance" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(DOKU_MAINTENANCE_MESSAGE);
    expect(screen.getByRole("link", { name: "Kembali ke katalog" })).toHaveAttribute("href", "/STORE/commerce");
    expect(screen.queryByText(/Total pembayaran|Ringkasan transaksi|Waiting Payment|Produk pesanan/)).not.toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.refreshStatus).not.toHaveBeenCalled();
  });

  it("continues five-second verification for uncertainty and goes to success only when verified", async () => {
    vi.useFakeTimers();
    const uncertain = { ...failed, status: "PENDING" as const, creation_state: "UNCERTAIN", can_retry_checkout: false, verification_pending: true };
    mocks.getStatus.mockResolvedValue(uncertain);
    mocks.refreshStatus.mockResolvedValue({ session: uncertain, checked: false });
    renderMaintenance();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole("alert")).toHaveTextContent(DOKU_MAINTENANCE_MESSAGE);
    expect(screen.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(2);
    mocks.refreshStatus.mockResolvedValue({ session: { ...uncertain, status: "PAID", transaction_status: "PAID" }, checked: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("Halaman sukses terverifikasi")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(3);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("recovers a saved READY URL after a lost response without creating another payment", async () => {
    sessionStorage.setItem("argopos.checkout-recovery.order-one", "1");
    mocks.getStatus.mockResolvedValue({ ...failed, status: "PENDING", transaction_status: "WAITING_TO_PAYMENT", creation_state: "READY", can_retry_checkout: false, checkout_url: "https://sandbox.doku.com/checkout/recovered" });
    renderMaintenance();
    expect(await screen.findByRole("button", { name: "Buka pembayaran DOKU" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Pembayaran siap dilanjutkan" })).toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.refreshStatus).not.toHaveBeenCalled();
  });

  it("never offers retry or success when payment requires review", async () => {
    mocks.getStatus.mockResolvedValue({ ...failed, status: "PAID", review_required: true });
    renderMaintenance();
    expect(await screen.findByRole("heading", { name: "Pembayaran perlu ditinjau" })).toBeInTheDocument();
    expect(screen.queryByText("Halaman sukses terverifikasi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajukan ulang pembayaran" })).not.toBeInTheDocument();
  });

  it("keeps access failures visible and stops automatic requests", async () => {
    vi.useFakeTimers();
    mocks.getStatus.mockRejectedValue(new PaymentRequestError("Akses pembayaran tidak tersedia.", 401));
    renderMaintenance();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(screen.getByText("Akses pembayaran tidak tersedia.")).toBeInTheDocument();
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.refreshStatus).not.toHaveBeenCalled();
  });

  it("shows maintenance without inventing an order when order creation is unavailable", () => {
    renderMaintenance(false);
    expect(screen.getByRole("alert")).toHaveTextContent(DOKU_MAINTENANCE_MESSAGE);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each(["REJECTED", "UNCERTAIN"])("explicitly retries %s and opens DOKU only after a ready response", async (creationState) => {
    const uncertain = creationState === "UNCERTAIN";
    const current = { ...failed, creation_state: creationState, status: uncertain ? "PENDING" as const : "FAILED" as const,
      can_retry_checkout: !uncertain, can_resume_checkout: uncertain, verification_pending: uncertain };
    mocks.getStatus.mockResolvedValue(current);
    mocks.refreshStatus.mockResolvedValue({ session: current, checked: false });
    let finish!: (value: PaymentSession) => void;
    mocks.createCheckout.mockReturnValue(new Promise<PaymentSession>(resolve => { finish = resolve; }));
    renderMaintenance();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled());
    const button = screen.getByRole("button", { name: "Ajukan ulang pembayaran" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.createCheckout).toHaveBeenCalledExactlyOnceWith("order-one", "attempt-one"));
    expect(screen.getByRole("button", { name: "Menyiapkan pembayaran..." })).toBeDisabled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
    const ready = { ...current, status: "PENDING" as const, creation_state: "READY", verification_pending: false, checkout_url: "https://sandbox.doku.com/checkout-link-v2/recovered" };
    await act(async () => { finish(ready); });
    await waitFor(() => expect(mocks.openCheckout).toHaveBeenCalledExactlyOnceWith("order-one", ready.checkout_url));
  });

  it("keeps maintenance and offers another explicit action when replay is still uncertain", async () => {
    const current = { ...failed, status: "PENDING" as const, creation_state: "UNCERTAIN", can_retry_checkout: false, can_resume_checkout: true, verification_pending: true };
    mocks.getStatus.mockResolvedValue(current);
    mocks.refreshStatus.mockResolvedValue({ session: current, checked: false });
    mocks.createCheckout.mockResolvedValue({ ...current, can_resume_checkout: false });
    renderMaintenance();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Ajukan ulang pembayaran" }));
    expect(await screen.findByText("Pembayaran belum berhasil disiapkan. Silakan ajukan ulang beberapa saat lagi.")).toBeInTheDocument();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Pembayaran sedang maintenance" })).toBeInTheDocument();
  });

  it("checks historical unknown attempts instead of inventing a replacement request", async () => {
    const current = { ...failed, status: "PENDING" as const, creation_state: "UNCERTAIN", can_retry_checkout: false, verification_pending: true };
    mocks.getStatus.mockResolvedValue(current);
    mocks.refreshStatus.mockResolvedValue({ session: current, checked: false });
    renderMaintenance();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajukan ulang pembayaran" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Ajukan ulang pembayaran" }));
    expect(await screen.findByText(/Permintaan pembayaran sebelumnya masih diperiksa/)).toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
  });
});
