import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Download, Loader2, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paymentService } from "@/lib/services/paymentService";
import { createPickupQrPng, pickupQrFilename } from "@/lib/pickupQrImage";

export function CustomerPickupQR({ transactionId }: { transactionId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mountedRef = useRef(false);
  const downloadInFlight = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["customer-pickup-qr", transactionId],
    queryFn: ({ signal }) => paymentService.getPickupQr(transactionId, signal),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const showQr = data && !error;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const downloadQr = async () => {
    if (!showQr || !svgRef.current || downloadInFlight.current) return;
    downloadInFlight.current = true;
    setDownloading(true);
    setDownloadError("");
    const svg = svgRef.current;
    try {
      const png = await createPickupQrPng(svg);
      if (!mountedRef.current || svgRef.current !== svg) return;
      const link = document.createElement("a");
      link.href = png;
      link.download = pickupQrFilename(transactionId);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      if (mountedRef.current) setDownloadError("Gambar QR belum dapat diunduh. Silakan coba lagi.");
    } finally {
      downloadInFlight.current = false;
      if (mountedRef.current) setDownloading(false);
    }
  };

  return (
    <section aria-labelledby="pickup-qr-title" className="commerce-panel grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[#071a4f]">
          <QrCode aria-hidden="true" className="h-5 w-5 shrink-0" />
          <h2 id="pickup-qr-title" className="font-extrabold">QR penyerahan barang</h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-slate-600">Tunjukkan QR ini kepada admin toko saat menerima pesanan. Setelah dipindai, penyerahan barang langsung tercatat selesai.</p>
        <p className="text-xs leading-relaxed text-slate-500">QR tidak memiliki batas waktu. Simpan gambar QR untuk digunakan saat pengambilan pesanan.</p>
        <Button variant="outline" onClick={() => void downloadQr()} disabled={!showQr || isFetching || downloading}>
          {downloading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="h-4 w-4" />}
          {downloading ? "Menyiapkan gambar..." : "Unduh QR (PNG)"}
        </Button>
        {downloadError && <p role="alert" className="max-w-md text-sm text-red-700">{downloadError}</p>}
        {error ? <div className="space-y-3">
          <p role="alert" className="max-w-md text-sm text-red-700">{error.message}</p>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Muat ulang QR
          </Button>
        </div> : null}
      </div>
      <div className="mx-auto w-[256px] max-w-full rounded-xl border border-slate-200 bg-white p-3 text-center">
        {showQr ? <>
          <QRCodeSVG ref={svgRef} value={data.qr_payload} size={232} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" role="img" aria-label="QR konfirmasi penyerahan barang" className="h-auto w-full" />
        </> : <div className="flex aspect-square flex-col items-center justify-center gap-3 px-3 text-sm text-slate-500" role="status">
          {isFetching ? <><Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" /><span>Menyiapkan QR...</span></> : <><QrCode aria-hidden="true" className="h-8 w-8" /><span>QR belum tersedia</span></>}
        </div>}
      </div>
    </section>
  );
}
