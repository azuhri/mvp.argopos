import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Camera, CameraOff, CheckCircle2, ImagePlus, Loader2, ScanLine, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { IScannerControls } from "@zxing/browser";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { pickupQrService, type PickupQrConfirmation } from "@/lib/services/pickupQrService";

type ScannerPhase = "idle" | "starting" | "scanning" | "reading-image" | "submitting" | "success" | "error";

function cameraErrorMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Akses kamera ditolak. Izinkan kamera melalui pengaturan browser, lalu coba lagi, atau unggah gambar QR.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Kamera tidak ditemukan. Hubungkan kamera atau unggah gambar QR pelanggan.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.";
  }
  return "Kamera belum dapat dibuka. Coba kamera lain atau unggah gambar QR pelanggan.";
}

function confirmationErrorMessage(error: unknown): string {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
  if (status === 401) return "Sesi admin berakhir. Masuk kembali sebelum memindai QR.";
  if (status === 403) return "Anda tidak memiliki akses untuk menyerahkan pesanan ini. Pastikan pesanan berasal dari toko yang ditugaskan kepada Anda.";
  if (status === 404) return "Pesanan tidak ditemukan. Minta pelanggan membuka kembali QR dari halaman pembayaran berhasil.";
  if (status && status >= 500) return "Konfirmasi belum dapat dipastikan. Pindai ulang QR yang sama untuk memeriksa hasilnya.";
  if (error instanceof Error && error.message && !["Network Error", "API request failed"].includes(error.message) && !/timeout/i.test(error.message)) return error.message;
  return "Konfirmasi belum dapat dipastikan. Periksa koneksi lalu pindai ulang QR yang sama untuk memeriksa hasilnya.";
}

export default function PickupQrScanner() {
  const { canWrite } = useAuth();
  const allowed = canWrite("transactions");
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<ScannerPhase>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PickupQrConfirmation | null>(null);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const completedRef = useRef(false);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopCamera(); };
  }, [stopCamera]);

  const confirm = useCallback(async (payload: string) => {
    if (!allowed || busyRef.current || completedRef.current || !mountedRef.current) return;
    busyRef.current = true;
    stopCamera();
    setCameraRequested(false);
    setMessage("");
    setPhase("submitting");
    try {
      if (!/^celestia-pickup-v[12]\./.test(payload) || payload.length > 4096) {
        throw new Error("QR ini bukan QR penyerahan Celestia. Minta pelanggan menampilkan QR pada halaman pembayaran berhasil.");
      }
      const confirmation = await pickupQrService.confirm(payload);
      if (!mountedRef.current) return;
      completedRef.current = true;
      setResult(confirmation);
      setPhase("success");
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey.some((key) => typeof key === "string" && /transaction/i.test(key)) });
    } catch (error) {
      if (mountedRef.current) {
        setMessage(confirmationErrorMessage(error));
        setPhase("error");
      }
    } finally {
      busyRef.current = false;
    }
  }, [allowed, queryClient, stopCamera]);

  useEffect(() => {
    if (!cameraRequested || !allowed) return;
    let cancelled = false;
    let decodedOnce = false;
    let ownedStream: MediaStream | null = null;
    setMessage("");
    setPhase("starting");
    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("CAMERA_UNAVAILABLE");
        }
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled) return;
        ownedStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } },
        });
        if (cancelled || !videoRef.current) {
          ownedStream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = ownedStream;
        const available = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (cancelled) return;
        setDevices(available.filter((device) => device.kind === "videoinput"));
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 1000 });
        const controls = await reader.decodeFromStream(ownedStream, videoRef.current, (decoded) => {
          if (!cancelled && !decodedOnce && decoded) { decodedOnce = true; void confirm(decoded.getText()); }
        });
        if (cancelled || decodedOnce || busyRef.current || completedRef.current) controls.stop();
        else { controlsRef.current = controls; setPhase("scanning"); }
      } catch (error) {
        if (cancelled) return;
        stopCamera();
        setCameraRequested(false);
        setPhase("error");
        setMessage(error instanceof Error && error.message === "CAMERA_UNAVAILABLE"
          ? "Kamera memerlukan browser dengan akses HTTPS atau localhost. Buka alamat HTTPS aplikasi atau unggah gambar QR."
          : cameraErrorMessage(error));
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopCamera();
      ownedStream?.getTracks().forEach((track) => track.stop());
    };
  }, [allowed, cameraRequested, confirm, deviceId, stopCamera]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState !== "hidden" || !cameraRequested) return;
      stopCamera();
      setCameraRequested(false);
      if (!busyRef.current) { setPhase("idle"); setMessage(""); }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, [cameraRequested, stopCamera]);

  const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !allowed || busyRef.current || completedRef.current) return;
    stopCamera();
    setCameraRequested(false);
    setMessage("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("Gunakan gambar QR PNG, JPG, atau WebP berukuran maksimal 10 MB.");
      setPhase("error");
      return;
    }
    busyRef.current = true;
    setPhase("reading-image");
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const decoded = await new BrowserQRCodeReader().decodeFromImageUrl(imageUrl);
      busyRef.current = false;
      if (mountedRef.current) await confirm(decoded.getText());
    } catch {
      if (mountedRef.current) {
        setMessage("QR tidak terbaca pada gambar. Gunakan gambar QR yang utuh dan jelas, lalu coba lagi.");
        setPhase("error");
      }
    } finally {
      URL.revokeObjectURL(imageUrl);
      busyRef.current = false;
    }
  };

  const startAgain = () => {
    completedRef.current = false;
    setResult(null);
    setMessage("");
    setPhase("idle");
  };
  const busy = phase === "submitting" || phase === "reading-image";

  return (
    <AppLayout title="Scan QR penyerahan">
      <section className="mx-auto max-w-2xl space-y-5" aria-labelledby="pickup-scanner-title">
        <div>
          <h1 id="pickup-scanner-title" className="text-2xl font-bold tracking-tight">Konfirmasi penyerahan barang</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pindai QR pelanggan saat barang diserahkan. Pemindaian yang valid langsung menyelesaikan pesanan.</p>
        </div>
        {!allowed ? (
          <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p>Anda memerlukan akses tulis transaksi untuk mengonfirmasi penyerahan barang.</p>
          </div>
        ) : result ? (
          <div className="rounded-2xl border border-emerald-300 bg-card p-6 text-center sm:p-8" role="status">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">{result.already_completed ? "Pesanan sudah diserahkan" : "Penyerahan berhasil"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{result.already_completed ? "Transaksi ini sebelumnya sudah selesai. Tidak ada perubahan tambahan." : "Barang telah diserahkan kepada pelanggan dan pesanan selesai."}</p>
            <p className="mt-5 break-all rounded-lg bg-muted px-4 py-3 font-mono text-sm">{result.transaction_code}</p>
            <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">COMPLETED</span>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={startAgain}><ScanLine className="mr-2 h-4 w-4" />Pindai pesanan berikutnya</Button>
              <Button asChild variant="outline"><Link to="/transactions">Lihat transaksi</Link></Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="relative aspect-square max-h-[420px] overflow-hidden rounded-xl bg-slate-950" aria-label="Pratinjau kamera pemindai QR">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-label="Kamera QR" />
              {phase !== "scanning" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
                  {busy || phase === "starting" ? <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" /> : <ScanLine className="h-14 w-14 text-white/70" aria-hidden="true" />}
                  <p className="text-sm" role="status">{phase === "submitting" ? "Mengonfirmasi penyerahan…" : phase === "reading-image" ? "Membaca gambar QR…" : phase === "starting" ? "Membuka kamera…" : "Arahkan kamera ke QR penyerahan pelanggan"}</p>
                </div>
              )}
              {phase === "scanning" && <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />}
            </div>
            {message && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">{message}</p>}
            {devices.length > 1 && (
              <div className="space-y-1.5">
                <label htmlFor="pickup-camera" className="text-sm font-medium">Pilih kamera</label>
                <select id="pickup-camera" value={deviceId} disabled={busy} onChange={(event) => setDeviceId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Kamera belakang (otomatis)</option>
                  {devices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Kamera ${index + 1}`}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="min-h-11 flex-1" disabled={busy} onClick={() => {
                if (cameraRequested) { stopCamera(); setCameraRequested(false); setPhase("idle"); }
                else setCameraRequested(true);
              }}>
                {cameraRequested ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
                {cameraRequested ? "Hentikan kamera" : "Aktifkan kamera"}
              </Button>
              <Button className="min-h-11 flex-1" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Unggah gambar QR</Button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Gambar QR penyerahan" className="sr-only" disabled={busy} onChange={(event) => { void readImage(event); }} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">Gunakan QR dari halaman pembayaran berhasil atau gambar QR yang telah disimpan pelanggan.</p>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
