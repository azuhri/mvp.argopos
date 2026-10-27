import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DokuPaymentPanel } from "./DokuPaymentPanel";
import { PaymentRequestError, type PaymentSession } from "@/lib/services/paymentService";

const mocks = vi.hoisted(() => ({ getStatus: vi.fn(), createCheckout: vi.fn(), refreshStatus: vi.fn() }));
vi.mock("@/lib/services/paymentService", async (original) => ({
  ...await original<typeof import("@/lib/services/paymentService")>(),
  paymentService: mocks,
}));

const pending: PaymentSession = {
  payment_id: "", transaction_id: "order-one", invoice_number: "", status: "PENDING",
  amount: 50000, expires_at: new Date(Date.now() + 3600000).toISOString(), verification_pending: false,
};
const clients: QueryClient[] = [];
function renderPanel(props: { returnMode?: boolean; onVerifiedPaid?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><DokuPaymentPanel transactionId="order-one" {...props} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.useRealTimers(); });

describe("DOKU payment panel", () => {
  beforeEach(() => {
    vi.clearAllMocks(); window.history.replaceState({}, "", "/"); mocks.getStatus.mockResolvedValue(pending);
    mocks.refreshStatus.mockResolvedValue({ session: pending, checked: false });
  });

  it("loads status without creating a session, including a purported successful return", async () => {
    window.history.replaceState({}, "", "/?doku_return=1&status=SUCCESS");
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Menunggu verifikasi pembayaran" })).toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Bayar melalui DOKU|Lanjutkan ke DOKU/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
  });

  it("submits once for duplicate clicks and shows an uncertain response without another create", async () => {
    let finish!: (value: PaymentSession) => void;
    mocks.createCheckout.mockReturnValue(new Promise<PaymentSession>((resolve) => { finish = resolve; }));
    renderPanel();
    const button = await screen.findByRole("button", { name: "Bayar melalui DOKU" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.createCheckout).toHaveBeenCalledTimes(1));
    finish({ ...pending, payment_id: "attempt-one", verification_pending: true, creation_state: "UNCERTAIN" });
    expect(await screen.findByRole("heading", { name: "Menunggu verifikasi pembayaran" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bayar melalui DOKU" })).not.toBeInTheDocument();
    expect(mocks.createCheckout).toHaveBeenCalledTimes(1);
  });

  it("rechecks canonical status before opening checkout and does not create once paid", async () => {
    mocks.getStatus.mockResolvedValueOnce(pending).mockResolvedValue({ ...pending, status: "PAID" });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Bayar melalui DOKU" }));
    expect(await screen.findByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("blocks checkout when the timestamp expires even while provider status is pending", async () => {
    mocks.getStatus.mockResolvedValue({ ...pending, expires_at: new Date(Date.now() - 1000).toISOString() });
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Waktu pembayaran berakhir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bayar melalui DOKU" })).not.toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("shows ownership failure without a payment initiation action", async () => {
    mocks.getStatus.mockRejectedValue(new PaymentRequestError("Gunakan browser asal pesanan.", 403));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Gunakan browser asal pesanan.");
    expect(screen.queryByRole("button", { name: "Bayar melalui DOKU" })).not.toBeInTheDocument();
  });

  it("keeps a late paid transaction under review without promising fulfillment", async () => {
    mocks.getStatus.mockResolvedValue({ ...pending, status: "PAID", review_required: true });
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Pembayaran perlu ditinjau" })).toBeInTheDocument();
    expect(screen.getByText(/Pembayaran telah diterima dan sedang diperiksa admin/)).toBeInTheDocument();
    expect(screen.getByText(/Jangan melakukan pembayaran ulang/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bayar melalui DOKU" })).not.toBeInTheDocument();
  });

  it("only permits a new attempt after a definitive rejection and explicit retry", async () => {
    mocks.getStatus.mockResolvedValue({ ...pending, payment_id: "failed-one", status: "FAILED", creation_state: "REJECTED" });
    mocks.createCheckout.mockResolvedValue({ ...pending, payment_id: "retry-one", verification_pending: true });
    renderPanel();
    const button = await screen.findByRole("button", { name: "Coba pembayaran kembali" });
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.createCheckout).toHaveBeenCalledWith("order-one", "failed-one"));
  });

  it("checks with the server once for duplicate refresh clicks and shows only returned verified PAID", async () => {
    let finish!: (value: { session: PaymentSession; checked: boolean }) => void;
    mocks.refreshStatus.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPanel();
    await screen.findByRole("button", { name: "Bayar melalui DOKU" });
    const button = screen.getByRole("button", { name: "Periksa status pembayaran" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.refreshStatus).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Memeriksa pembayaran..." })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    const paid = { ...pending, status: "PAID" as const };
    mocks.getStatus.mockResolvedValue(paid);
    finish({ session: paid, checked: true });
    expect(await screen.findByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    expect(mocks.refreshStatus).toHaveBeenCalledWith("order-one");
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("keeps pending when provider checking is deferred or unavailable", async () => {
    const unverified = { ...pending, verification_pending: true };
    mocks.refreshStatus.mockResolvedValue({ session: unverified, checked: false });
    mocks.getStatus.mockResolvedValue(unverified);
    renderPanel();
    await screen.findByRole("heading", { name: "Menunggu verifikasi pembayaran" });
    fireEvent.click(screen.getByRole("button", { name: "Periksa status pembayaran" }));
    expect(await screen.findByText(/Belum ada konfirmasi baru/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([404, 503])("retains pending state on refresh HTTP %s instead of claiming payment succeeded", async (status) => {
    mocks.refreshStatus.mockRejectedValue(new PaymentRequestError("Status belum tersedia. Coba kembali.", status));
    renderPanel();
    await screen.findByRole("button", { name: "Bayar melalui DOKU" });
    fireEvent.click(screen.getByRole("button", { name: "Periksa status pembayaran" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Status belum tersedia. Coba kembali.");
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([401, 403])("blocks payment initiation after refresh denies access with HTTP %s", async (status) => {
    mocks.refreshStatus.mockRejectedValue(new PaymentRequestError("Gunakan browser asal pesanan.", status));
    renderPanel();
    await screen.findByRole("button", { name: "Bayar melalui DOKU" });
    fireEvent.click(screen.getByRole("button", { name: "Periksa status pembayaran" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gunakan browser asal pesanan.");
    expect(screen.queryByRole("button", { name: "Bayar melalui DOKU" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("allows an explicit late-payment check for an expired attempt without reopening checkout", async () => {
    mocks.getStatus.mockResolvedValue({ ...pending, status: "EXPIRED" });
    renderPanel();
    await screen.findByRole("heading", { name: "Pembayaran kedaluwarsa" });
    const latePaid = { ...pending, status: "PAID" as const, review_required: true };
    mocks.getStatus.mockResolvedValue(latePaid);
    mocks.refreshStatus.mockResolvedValue({ session: latePaid, checked: true });
    fireEvent.click(screen.getByRole("button", { name: "Periksa status pembayaran" }));
    expect(await screen.findByRole("heading", { name: "Pembayaran perlu ditinjau" })).toBeInTheDocument();
    expect(screen.getByText(/Pembayaran telah diterima dan sedang diperiksa admin/)).toBeInTheDocument();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("verifies the return immediately and every five seconds, then stops only on canonical PAID", async () => {
    vi.useFakeTimers();
    const onVerifiedPaid = vi.fn();
    mocks.refreshStatus.mockResolvedValue({ session: { ...pending, checkout_url: "https://sandbox.doku.com/checkout/test" }, checked: true });
    renderPanel({ returnMode: true, onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /DOKU/ })).not.toBeInTheDocument();
    expect(onVerifiedPaid).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(2);
    mocks.refreshStatus.mockResolvedValue({ session: { ...pending, status: "PAID" }, checked: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(3);
    expect(onVerifiedPaid).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(3);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([true, false])("does not overlap slow checks and aborts on unmount (returnMode=%s)", async (returnMode) => {
    vi.useFakeTimers();
    mocks.getStatus.mockResolvedValue({ ...pending, payment_id: "existing-attempt" });
    let finish!: (value: { session: PaymentSession; checked: boolean }) => void;
    mocks.refreshStatus.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = renderPanel({ returnMode });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ session: pending, checked: false }); await vi.advanceTimersByTimeAsync(1); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(2);
    const signal = mocks.refreshStatus.mock.calls[1][1] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(2);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("automatically verifies a reopened pending attempt without a return marker", async () => {
    vi.useFakeTimers();
    const onVerifiedPaid = vi.fn();
    const attempt = { ...pending, payment_id: "existing-attempt", creation_state: "READY" as const, verification_pending: true };
    mocks.getStatus.mockResolvedValue(attempt);
    mocks.refreshStatus.mockResolvedValue({ session: attempt, checked: false });
    renderPanel({ onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    expect(onVerifiedPaid).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(3999); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(2);
    // The database GET is still stale; verified refresh must drive success.
    mocks.refreshStatus.mockResolvedValue({ session: { ...attempt, status: "PAID" }, checked: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(3);
    expect(onVerifiedPaid).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(3);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([false, true])("observes webhook PAID without a provider refresh (returnMode=%s)", async (returnMode) => {
    vi.useFakeTimers();
    const onVerifiedPaid = vi.fn();
    mocks.getStatus.mockResolvedValue({ ...pending, payment_id: "existing-attempt", status: "PAID" });
    renderPanel({ returnMode, onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(onVerifiedPaid).toHaveBeenCalledTimes(1);
    expect(mocks.refreshStatus).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("does not initiate or refresh a provider session before checkout exists", async () => {
    vi.useFakeTimers();
    renderPanel();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mocks.getStatus.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.refreshStatus).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])("stops reopened-order verification after refresh HTTP %s", async (status) => {
    vi.useFakeTimers();
    mocks.getStatus.mockResolvedValue({ ...pending, payment_id: "existing-attempt" });
    mocks.refreshStatus.mockRejectedValue(new PaymentRequestError("Akses pembayaran tidak tersedia.", status));
    const onVerifiedPaid = vi.fn();
    renderPanel({ onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(onVerifiedPaid).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])("stops automatic checks after HTTP %s without claiming success", async (status) => {
    vi.useFakeTimers();
    const onVerifiedPaid = vi.fn();
    mocks.refreshStatus.mockRejectedValue(new PaymentRequestError("Akses pembayaran tidak tersedia.", status));
    renderPanel({ returnMode: true, onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Akses pembayaran tidak tersedia.");
    expect(onVerifiedPaid).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("recovers a failed automatic check at the next interval without assuming payment succeeded", async () => {
    vi.useFakeTimers();
    const onVerifiedPaid = vi.fn();
    mocks.refreshStatus.mockRejectedValueOnce(new PaymentRequestError("Koneksi terputus.", 503))
      .mockResolvedValue({ session: { ...pending, verification_pending: true }, checked: false });
    renderPanel({ returnMode: true, onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole("alert")).toHaveTextContent("Koneksi terputus.");
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onVerifiedPaid).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it.each([
    { status: "EXPIRED" as const }, { status: "FAILED" as const },
    { status: "PAID" as const, review_required: true },
  ])("stops for terminal state $status without opening success for a review", async (state) => {
    vi.useFakeTimers();
    const onVerifiedPaid = vi.fn();
    mocks.refreshStatus.mockResolvedValue({ session: { ...pending, ...state }, checked: true });
    renderPanel({ returnMode: true, onVerifiedPaid });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.refreshStatus).toHaveBeenCalledTimes(1);
    expect(onVerifiedPaid).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });
});
