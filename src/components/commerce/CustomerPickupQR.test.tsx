import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerPickupQR } from "./CustomerPickupQR";

const mocks = vi.hoisted(() => ({ getPickupQr: vi.fn(), createPng: vi.fn() }));
vi.mock("@/lib/services/paymentService", () => ({ paymentService: mocks }));
vi.mock("@/lib/pickupQrImage", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/pickupQrImage")>()), createPickupQrPng: mocks.createPng }));
const clients: QueryClient[] = [];
const qr = (id = "order-one") => ({ transaction_id: id, qr_payload: "celestia-pickup-v2.fixture.signature", issued_at: "2026-10-23T10:00:00Z" });
const advance = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><CustomerPickupQR transactionId="order-one" /></QueryClientProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getPickupQr.mockReset().mockResolvedValue(qr());
  mocks.createPng.mockReset().mockResolvedValue("data:image/png;base64,fixture");
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("customer handover QR", () => {
  it("renders a local non-expiring SVG without external requests or browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mount();
    await advance(10);
    expect(screen.getByRole("img", { name: "QR konfirmasi penyerahan barang" }).tagName.toLowerCase()).toBe("svg");
    expect(screen.getByText(/QR tidak memiliki batas waktu/)).toBeInTheDocument();
    expect(screen.queryByText(/Berlaku selama|5 menit/)).not.toBeInTheDocument();
    expect(mocks.getPickupQr).toHaveBeenCalledWith("order-one", expect.any(AbortSignal));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("keeps the same QR after multiple days without automatic renewal", async () => {
    mocks.getPickupQr.mockResolvedValue({ ...qr(), expires_at: "2026-10-23T10:05:00Z" });
    mount();
    await advance(10);
    const svg = screen.getByRole("img").innerHTML;
    await advance(2 * 24 * 60 * 60 * 1000);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("img").innerHTML).toBe(svg);
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Unduh QR (PNG)" })).toBeEnabled();
  });

  it("does not rotate or hide the QR when a hidden tab returns the following day", async () => {
    mount();
    await advance(10);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await advance(24 * 60 * 60 * 1000);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await advance(10);
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("offers explicit retry after failure without repeated requests or enabling download", async () => {
    mocks.getPickupQr.mockRejectedValueOnce(new Error("QR belum tersedia."));
    mount();
    await advance(10);
    expect(screen.getByRole("alert")).toHaveTextContent("QR belum tersedia.");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh QR (PNG)" })).toBeDisabled();
    await advance(20000);
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang QR" }));
    await advance(10);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("downloads the rendered QR locally once with a safe PNG filename", async () => {
    const clicked: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    mount(); await advance(10);
    const button = screen.getByRole("button", { name: "Unduh QR (PNG)" });
    fireEvent.click(button); fireEvent.click(button);
    await advance(10);
    expect(mocks.createPng).toHaveBeenCalledTimes(1);
    expect(mocks.createPng.mock.calls[0][0]).toBe(screen.getByRole("img"));
    expect(click).toHaveBeenCalledTimes(1);
    const link = clicked[0];
    expect(link.download).toBe("qr-penyerahan-order-one.png");
    expect(link.href).toBe("data:image/png;base64,fixture");
    expect(link.isConnected).toBe(false);
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
  });

  it("keeps the QR visible and offers retry when PNG generation fails", async () => {
    mocks.createPng.mockRejectedValueOnce(new Error("Canvas failed"));
    mount(); await advance(10);
    fireEvent.click(screen.getByRole("button", { name: "Unduh QR (PNG)" }));
    await advance(10);
    expect(screen.getByRole("alert")).toHaveTextContent("Gambar QR belum dapat diunduh");
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh QR (PNG)" })).toBeEnabled();
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
  });

  it("does not finish a pending download after the customer leaves or completes the order", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let finish!: (value: string) => void;
    mocks.createPng.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
    const view = mount(); await advance(10);
    fireEvent.click(screen.getByRole("button", { name: "Unduh QR (PNG)" }));
    expect(screen.getByRole("button", { name: "Menyiapkan gambar..." })).toBeDisabled();
    view.unmount();
    await act(async () => { finish("data:image/png;base64,fixture"); });
    expect(click).not.toHaveBeenCalled();
  });

  it("aborts pending issuance and removes the ephemeral QR cache on unmount", async () => {
    let signal!: AbortSignal;
    mocks.getPickupQr.mockImplementation((_id, abortSignal) => { signal = abortSignal; return new Promise(() => {}); });
    const view = mount();
    await advance(10);
    view.unmount();
    await advance(10);
    expect(signal.aborted).toBe(true);
    expect(clients[0].getQueryData(["customer-pickup-qr", "order-one"])).toBeUndefined();
    await advance(310000);
    expect(mocks.getPickupQr).toHaveBeenCalledTimes(1);
  });
});
