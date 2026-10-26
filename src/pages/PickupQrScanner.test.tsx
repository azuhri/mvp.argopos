import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import PickupQrScanner from "./PickupQrScanner";

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), canWrite: vi.fn(), decodeStream: vi.fn(), decodeImage: vi.fn(), stop: vi.fn(), trackStop: vi.fn(), getUserMedia: vi.fn() }));
vi.mock("@/lib/services/pickupQrService", () => ({ pickupQrService: { confirm: mocks.confirm } }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ canWrite: mocks.canWrite }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@zxing/browser", () => ({ BrowserQRCodeReader: class { decodeFromStream = mocks.decodeStream; decodeFromImageUrl = mocks.decodeImage; } }));

const payload = "celestia-pickup-v2.test-payload.test-signature";
const completion = { transaction_id: "order-1", transaction_code: "TRX-DOKU-TEST", status: "COMPLETED", already_completed: false };
const stream = { getTracks: () => [{ stop: mocks.trackStop }] };
let decode: (result: { getText: () => string } | undefined) => void;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><PickupQrScanner /></MemoryRouter></QueryClientProvider>);
}
async function openCamera() {
  fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" }));
  await waitFor(() => expect(mocks.decodeStream).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canWrite.mockReturnValue(true);
  mocks.confirm.mockResolvedValue(completion);
  mocks.getUserMedia.mockResolvedValue(stream);
  mocks.decodeStream.mockImplementation(async (_stream, _video, callback) => { decode = callback; return { stop: mocks.stop }; });
  mocks.decodeImage.mockResolvedValue({ getText: () => payload });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    getUserMedia: mocks.getUserMedia,
    enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "back", label: "Back" }, { kind: "videoinput", deviceId: "front", label: "Front" }]),
  } });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:qr-test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("staff QR handover scanner", () => {
  it("submits a decoded QR immediately once, closes the camera, and shows canonical completion", async () => {
    let finish!: (value: typeof completion) => void;
    mocks.confirm.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    setup();
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    await openCamera();
    act(() => { decode({ getText: () => payload }); decode({ getText: () => payload }); });
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(payload);
    expect(mocks.trackStop).toHaveBeenCalled();
    expect(screen.getByText("Mengonfirmasi penyerahan…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktifkan kamera" })).toBeDisabled();
    await act(async () => { finish(completion); });
    expect(screen.getByRole("heading", { name: "Penyerahan berhasil" })).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("TRX-DOKU-TEST")).toBeInTheDocument();
  });

  it("shows an idempotent replay without claiming a new handover", async () => {
    mocks.confirm.mockResolvedValue({ ...completion, already_completed: true });
    setup(); await openCamera();
    await act(async () => { decode({ getText: () => payload }); });
    expect(screen.getByRole("heading", { name: "Pesanan sudah diserahkan" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pindai pesanan berikutnya" }));
    expect(screen.getByRole("button", { name: "Aktifkan kamera" })).toBeEnabled();
  });

  it.each([
    [Object.assign(new Error("Forbidden"), { status: 403 }), "Anda tidak memiliki akses"],
    [Object.assign(new Error("Pesanan belum dapat diserahkan."), { status: 409 }), "Pesanan belum dapat diserahkan"],
    [new Error("Network Error"), "Konfirmasi belum dapat dipastikan"],
    [Object.assign(new Error("API request failed"), { status: undefined }), "Konfirmasi belum dapat dipastikan"],
  ])("does not mark an unconfirmed scan complete (%s)", async (error, message) => {
    mocks.confirm.mockRejectedValue(error);
    setup(); await openCamera();
    await act(async () => { decode({ getText: () => payload }); });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktifkan kamera" })).toBeEnabled();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });

  it("never turns an unrelated QR or raw transaction ID into a completion request", async () => {
    setup(); await openCamera();
    await act(async () => { decode({ getText: () => "order-1" }); });
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("bukan QR penyerahan Celestia");
  });

  it("still submits a legacy signed v1 QR for server verification", async () => {
    setup(); await openCamera();
    const legacy = payload.replace("-v2.", "-v1.");
    await act(async () => { decode({ getText: () => legacy }); });
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(legacy);
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
  });

  it("offers a recovery path when camera permission is denied", async () => {
    mocks.getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Akses kamera ditolak"));
    expect(screen.getByRole("button", { name: "Unggah gambar QR" })).toBeEnabled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("does not request camera on insecure origins", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    setup(); fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("HTTPS atau localhost"));
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
  });

  it("stops a pending camera request that resolves after leaving the page", async () => {
    let finish!: (value: typeof stream) => void;
    mocks.getUserMedia.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const view = setup(); fireEvent.click(screen.getByRole("button", { name: "Aktifkan kamera" }));
    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => { finish(stream); });
    expect(mocks.trackStop).toHaveBeenCalled();
    expect(mocks.decodeStream).not.toHaveBeenCalled();
  });

  it("releases the old stream before switching cameras and on unmount", async () => {
    const view = setup(); await openCamera();
    fireEvent.change(screen.getByLabelText("Pilih kamera"), { target: { value: "front" } });
    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: { deviceId: { exact: "front" } } }));
    expect(mocks.trackStop).toHaveBeenCalled();
    await waitFor(() => expect(mocks.decodeStream).toHaveBeenCalledTimes(2));
    view.unmount(); expect(mocks.stop).toHaveBeenCalledTimes(2);
  });

  it("pauses decoding when the browser is backgrounded", async () => {
    setup(); await openCamera();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(mocks.trackStop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Aktifkan kamera" })).toBeEnabled();
  });

  it("decodes an uploaded image and releases its temporary URL", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Gambar QR penyerahan"), { target: { files: [new File(["qr"], "qr.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("COMPLETED")).toBeInTheDocument());
    expect(mocks.decodeImage).toHaveBeenCalledExactlyOnceWith("blob:qr-test");
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(payload);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:qr-test");
  });

  it("rejects an unreadable image without submitting a transaction", async () => {
    mocks.decodeImage.mockRejectedValue(new Error("Not found"));
    setup();
    fireEvent.change(screen.getByLabelText("Gambar QR penyerahan"), { target: { files: [new File(["bad image"], "qr.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("QR tidak terbaca"));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("blocks both camera and image actions without transaction write permission", () => {
    mocks.canWrite.mockReturnValue(false);
    setup();
    expect(screen.getByRole("alert")).toHaveTextContent("akses tulis transaksi");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
