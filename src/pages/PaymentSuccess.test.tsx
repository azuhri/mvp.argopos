import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentRequestError } from "@/lib/services/paymentService";
import PaymentSuccess from "./PaymentSuccess";

const mocks = vi.hoisted(() => ({ removePendingPayment: vi.fn(), getStatus: vi.fn(), downloadInvoice: vi.fn(), createObjectURL: vi.fn(), revokeObjectURL: vi.fn() }));
vi.mock("@/lib/pendingPaymentStorage", () => mocks);
vi.mock("@/lib/services/paymentService", async (original) => ({
  ...await original<typeof import("@/lib/services/paymentService")>(), paymentService: mocks,
}));
vi.mock("@/components/layout/AppLayoutCommerce", () => ({ AppLayoutCommerce: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/commerce/CustomerPickupQR", () => ({ CustomerPickupQR: ({ transactionId }: { transactionId: string }) => <p>QR penyerahan: {transactionId}</p> }));
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PENDING", review_required: false });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const transactionData = (status: string, provider = "DOKU") => ({ id: "order-one", transaction_code: "TRX-ONE", status, total_amount: 50000, base_amount: 50000, total_item: 1, payment_provider: provider, transaction_carts: [] });
const transactionResponse = (status: string) => ({ ok: true, json: async () => ({ success: true, data: transactionData(status) }) });
const advance = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function renderStatus(status: string, provider = "DOKU", options?: { cachedStatus: string; response: Promise<unknown> }) {
  const data = transactionData(status, provider);
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(options?.response ?? Promise.resolve({ ok: true, json: async () => ({ success: true, data }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (options) client.setQueryData(["transaction", "order-one"], { ...data, status: options.cachedStatus });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/STORE/commerce/payment-success/order-one?status=SUCCESS"]}><Routes><Route path="/:locationCode/commerce/payment-success/:transactionId" element={<PaymentSuccess />} /><Route path="/:locationCode/commerce/payment/:transactionId" element={<p>Detail pembayaran canonical</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("verified payment success", () => {
  it("returns an unpaid direct success visit to details and preserves recovery", async () => {
    renderStatus("WAITING_TO_PAYMENT");
    expect(await screen.findByText("Detail pembayaran canonical")).toBeInTheDocument();
    expect(mocks.removePendingPayment).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    expect(mocks.downloadInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ["PAID", "Menunggu persiapan"],
    ["PREPARING_PRODUCT", "Sedang disiapkan"],
    ["READY_TO_PICKUP", "Siap diambil"],
  ])("shows owned PAID during %s without claiming goods were received", async (status, label) => {
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    renderStatus(status);
    expect(await screen.findByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh invoice PDF" })).toBeEnabled();
    expect(screen.queryByText(/Penerimaan barang telah tercatat|item telah diterima/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lihat detail transaksi" })).toHaveAttribute("href", "/STORE/commerce/payment/order-one?view=order");
    expect(mocks.removePendingPayment).toHaveBeenCalledWith("order-one");
    expect(screen.queryByText("Kode unik")).not.toBeInTheDocument();
    expect(mocks.downloadInvoice).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Status pesanan" }).querySelector('[aria-current="step"]')).toHaveTextContent(label);
    expect(screen.getByText("QR penyerahan: order-one")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mulai persiapan|Upload Bukti/ })).not.toBeInTheDocument();
  });

  it("only claims receipt completion when the backend confirms COMPLETED and owned PAID", async () => {
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    renderStatus("COMPLETED");
    expect(await screen.findByText("Transaksi berhasil diselesaikan")).toBeInTheDocument();
    expect(screen.getByText(/Penerimaan barang telah tercatat/)).toBeInTheDocument();
    expect(screen.queryByText("QR penyerahan: order-one")).not.toBeInTheDocument();
    expect(mocks.removePendingPayment).toHaveBeenCalledWith("order-one");
    expect(screen.getByRole("region", { name: "Status pesanan" }).querySelector('[aria-current="step"]')).toHaveTextContent("Pesanan diterima");
  });

  it("waits for canonical fulfillment when transaction data lags verified payment", async () => {
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    renderStatus("WAITING_TO_PAYMENT");
    expect(await screen.findByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    expect(screen.getByText("Menunggu pembaruan status")).toBeInTheDocument();
    expect(screen.queryByText("QR penyerahan: order-one")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Status pesanan" }).querySelector('[aria-current="step"]')).toBeNull();
  });

  it("polls fulfillment every five seconds and stops at COMPLETED without rechecking DOKU", async () => {
    vi.useFakeTimers();
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    renderStatus("PAID");
    await advance(10);
    await advance(10);
    expect(fetch).toHaveBeenCalledTimes(1);
    await advance(4000);
    expect(fetch).toHaveBeenCalledTimes(1);
    for (const [status, label] of [["PREPARING_PRODUCT", "Sedang disiapkan"], ["READY_TO_PICKUP", "Siap diambil"], ["COMPLETED", "Pesanan diterima"]]) {
      vi.mocked(fetch).mockResolvedValue(transactionResponse(status) as Response);
      await advance(status === "PREPARING_PRODUCT" ? 1000 : 5000);
      await advance(10);
      expect(screen.getByRole("region", { name: "Status pesanan" }).querySelector('[aria-current="step"]')).toHaveTextContent(label);
      expect(screen.getByRole("button", { name: "Unduh invoice PDF" })).toBeEnabled();
    }
    expect(fetch).toHaveBeenCalledTimes(4);
    await advance(20000);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Status diperbarui otomatis/)).not.toBeInTheDocument();
    expect(screen.queryByText("QR penyerahan: order-one")).not.toBeInTheDocument();
  });

  it("retains success and the last progress after a transient failure, then recovers on the next tick", async () => {
    vi.useFakeTimers();
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    renderStatus("PREPARING_PRODUCT");
    await advance(10);
    await advance(10);
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    await advance(5010);
    expect(screen.getByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Progres terakhir tetap ditampilkan");
    expect(screen.getByRole("region", { name: "Status pesanan" }).querySelector('[aria-current="step"]')).toHaveTextContent("Sedang disiapkan");
    vi.mocked(fetch).mockResolvedValue(transactionResponse("READY_TO_PICKUP") as Response);
    await advance(5010);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Status pesanan" }).querySelector('[aria-current="step"]')).toHaveTextContent("Siap diambil");
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
  });

  it("pauses in a hidden tab, avoids overlapping slow requests, and aborts on unmount", async () => {
    vi.useFakeTimers();
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    const view = renderStatus("PAID");
    await advance(10);
    await advance(10);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await advance(10000);
    expect(fetch).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}));
    await advance(15000);
    expect(fetch).toHaveBeenCalledTimes(2);
    const signal = vi.mocked(fetch).mock.calls[1][1]?.signal;
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await advance(15000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404])("stops polling if the transaction becomes unavailable (%s)", async (status) => {
    vi.useFakeTimers();
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    renderStatus("PAID");
    await advance(10);
    await advance(10);
    vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response);
    await advance(5010);
    expect(screen.getByText("Ringkasan transaksi tidak tersedia")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Status pesanan" })).not.toBeInTheDocument();
    await advance(15000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not show success or invoice for a paid payment under review", async () => {
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID", review_required: true });
    renderStatus("PAID");
    expect(await screen.findByText("Detail pembayaran canonical")).toBeInTheDocument();
    expect(mocks.removePendingPayment).not.toHaveBeenCalled();
    expect(mocks.downloadInvoice).not.toHaveBeenCalled();
  });

  it("requires owned proof even when public transaction status is PAID", async () => {
    mocks.getStatus.mockRejectedValue(new PaymentRequestError("Gunakan browser tempat pesanan dibuat.", 401));
    renderStatus("PAID");
    expect(await screen.findByRole("alert")).toHaveTextContent("Gunakan browser tempat pesanan dibuat.");
    expect(screen.queryByRole("heading", { name: "Pembayaran berhasil" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unduh invoice PDF" })).not.toBeInTheDocument();
    expect(screen.queryByText("QR penyerahan: order-one")).not.toBeInTheDocument();
    expect(mocks.removePendingPayment).not.toHaveBeenCalled();
  });

  it("preserves manual completed receipt flow without calling payment or invoice endpoints", async () => {
    renderStatus("COMPLETED", "MANUAL");
    expect(await screen.findByText("Transaksi berhasil diselesaikan")).toBeInTheDocument();
    expect(screen.getByText("Kode unik")).toBeInTheDocument();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.downloadInvoice).not.toHaveBeenCalled();
  });

  it("waits for fresh manual COMPLETED after receipt confirmation instead of redirecting on cached READY_TO_PICKUP", async () => {
    let finish!: (value: unknown) => void;
    const response = new Promise((resolve) => { finish = resolve; });
    renderStatus("COMPLETED", "MANUAL", { cachedStatus: "READY_TO_PICKUP", response });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Detail pembayaran canonical")).not.toBeInTheDocument();
    expect(screen.queryByText("Transaksi berhasil diselesaikan")).not.toBeInTheDocument();
    expect(mocks.removePendingPayment).not.toHaveBeenCalled();
    await act(async () => { finish({ ok: true, json: async () => ({ success: true, data: {
      id: "order-one", transaction_code: "TRX-ONE", status: "COMPLETED", payment_provider: "MANUAL",
      total_amount: 50000, base_amount: 50000, total_item: 1, transaction_carts: [],
    } }) }); });
    expect(await screen.findByText("Transaksi berhasil diselesaikan")).toBeInTheDocument();
    expect(screen.getByText(/Penerimaan barang telah tercatat/)).toBeInTheDocument();
    expect(screen.queryByText("Detail pembayaran canonical")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unduh invoice PDF" })).not.toBeInTheDocument();
    expect(mocks.removePendingPayment).toHaveBeenCalledWith("order-one");
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.downloadInvoice).not.toHaveBeenCalled();
  });

  it("keeps success after invoice failure and lets the customer retry a PDF download", async () => {
    mocks.getStatus.mockResolvedValue({ transaction_id: "order-one", status: "PAID" });
    mocks.downloadInvoice.mockRejectedValueOnce(new PaymentRequestError("Invoice belum dapat diunduh. Coba kembali sebentar lagi.", 503))
      .mockResolvedValue({ blob: new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), filename: "Invoice-CEL-ONE.pdf" });
    mocks.createObjectURL.mockReturnValue("blob:test-invoice");
    vi.stubGlobal("URL", class extends URL { static createObjectURL = mocks.createObjectURL; static revokeObjectURL = mocks.revokeObjectURL; });
    const downloads: { filename: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { downloads.push({ filename: this.download, href: this.href }); });
    renderStatus("PAID");
    fireEvent.click(await screen.findByRole("button", { name: "Unduh invoice PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invoice belum dapat diunduh.");
    expect(screen.getByRole("heading", { name: "Pembayaran berhasil" })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Unduh invoice PDF" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(downloads).toEqual([{ filename: "Invoice-CEL-ONE.pdf", href: "blob:test-invoice" }]));
    expect(mocks.downloadInvoice).toHaveBeenCalledTimes(2);
    expect(mocks.downloadInvoice).toHaveBeenLastCalledWith("order-one");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:test-invoice"), { timeout: 2000 });
  });
});
