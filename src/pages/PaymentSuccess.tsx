import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ImageOff,
  Loader2,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { LoadingSpinner } from "@/components/shared/SkeletonLoader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { config } from "@/lib/config";
import { formatCurrency } from "@/lib/mockData";
import { getStatusBadgeKey } from "@/lib/utils";
import { removePendingPayment } from "@/lib/pendingPaymentStorage";
import { PaymentRequestError, paymentService } from "@/lib/services/paymentService";

interface TransactionCart {
  id?: string;
  product_stock_id: string;
  amount: number;
  qty: number;
  product_details?: {
    product_name: string;
    image_path: string;
  };
}

interface TransactionData {
  id: string;
  payment_provider?: string;
  transaction_code: string;
  status: string;
  payment_code?: string;
  nominal_code: string;
  base_amount: number;
  total_amount: number;
  total_item: number;
  customer_name: string;
  transaction_carts: TransactionCart[];
}

function resolveAssetUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${config.endpointUrl}/${path.replace(/^\/+/, "")}`;
}

export default function PaymentSuccess() {
  const { locationCode, transactionId } = useParams<{ locationCode: string; transactionId: string }>();
  const downloading = useRef(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const {
    data: transactionData,
    isLoading,
    isFetching: transactionFetching,
    error,
  } = useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const response = await fetch(`${config.apiUrl}/transactions/${transactionId}`);
      if (!response.ok) throw new Error("Failed to fetch transaction data");
      const result = await response.json();
      return result.data as TransactionData;
    },
    enabled: Boolean(transactionId),
    refetchOnMount: "always",
  });

  const isDoku = transactionData?.payment_provider === "DOKU";
  const paymentQuery = useQuery({
    queryKey: ["doku-payment", transactionId],
    queryFn: ({ signal }) => paymentService.getStatus(transactionId!, signal),
    enabled: Boolean(transactionId && isDoku),
    staleTime: 0,
    refetchOnMount: "always",
    retry: (count, requestError) => !(requestError instanceof PaymentRequestError && [401, 403, 404].includes(requestError.status)) && count < 1,
  });
  const verifiedPaid = isDoku && !paymentQuery.isFetching && !paymentQuery.error && paymentQuery.data?.status === "PAID" && !paymentQuery.data.review_required;
  const completed = transactionData?.status === "COMPLETED";

  useEffect(() => {
    if (transactionId && (verifiedPaid || (!isDoku && completed && !transactionFetching && !error))) removePendingPayment(transactionId);
  }, [transactionId, verifiedPaid, isDoku, completed, transactionFetching, error]);

  const downloadInvoice = async () => {
    if (!transactionId || !verifiedPaid || downloading.current) return;
    downloading.current = true;
    setIsDownloading(true);
    setDownloadError("");
    try {
      const { blob, filename } = await paymentService.downloadInvoice(transactionId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setDownloadError(requestError instanceof Error ? requestError.message : "Invoice belum dapat diunduh. Coba kembali sebentar lagi.");
    } finally {
      downloading.current = false;
      setIsDownloading(false);
    }
  };

  if (isLoading || (!isDoku && transactionFetching) || (isDoku && (paymentQuery.isPending || paymentQuery.isFetching))) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      </AppLayoutCommerce>
    );
  }

  if (error || !transactionData) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-red-50 text-[#e30613]">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-[#071a4f]">Ringkasan transaksi tidak tersedia</h1>
          <p className="mt-2 text-sm text-slate-500">Kembali ke katalog atau buka kembali detail pembayaran.</p>
          <Button asChild className="mt-6 rounded-md bg-[#071a4f] hover:bg-[#102866]">
            <Link to="/commerce">Kembali ke katalog</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  if (isDoku && paymentQuery.error) {
    return <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
      <section className="commerce-panel mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-extrabold text-[#071a4f]">Pembayaran belum dapat diverifikasi</h1>
        <p role="alert" className="text-sm text-slate-600">{paymentQuery.error.message}</p>
        <Button onClick={() => void paymentQuery.refetch()} className="commerce-orange-button w-full">Periksa kembali</Button>
        <Button asChild variant="outline" className="w-full"><Link to={`/${locationCode}/commerce/payment/${transactionId}?view=order`}>Lihat detail transaksi</Link></Button>
      </section>
    </AppLayoutCommerce>;
  }

  if (isDoku ? !verifiedPaid : !completed) {
    return <Navigate to={`/${locationCode}/commerce/payment/${transactionId}`} replace />;
  }

  const items = transactionData.transaction_carts || [];

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
      <div className="mx-auto w-full max-w-[960px] space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold text-[#e30613]">Checkout selesai</p>
            <h1 className="mt-1 text-2xl font-extrabold text-[#071a4f] md:text-3xl">{isDoku ? "Pembayaran berhasil" : "Terima kasih telah berbelanja"}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
            <span>1. Keranjang</span>
            <span aria-hidden="true">/</span>
            <span>2. Pembayaran</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#071a4f]">3. Selesai</span>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="commerce-panel overflow-hidden"
        >
          <div className="grid md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-6 md:p-8">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-extrabold text-[#071a4f]">{completed ? "Transaksi berhasil diselesaikan" : "Pembayaran telah dikonfirmasi"}</h2>
                <StatusBadge status={getStatusBadgeKey(isDoku && !completed ? "PAID" : transactionData.status)} />
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
                {completed ? "Penerimaan barang telah tercatat. Simpan kode transaksi berikut sebagai referensi pesanan Anda." : "Terima kasih. Pembayaran Anda telah diterima. Simpan invoice sebagai bukti pembayaran dan pantau penyiapan pesanan melalui detail transaksi."}
              </p>
              <div className="mt-6 inline-flex max-w-full items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <ReceiptText className="h-5 w-5 shrink-0 text-[#e30613]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Kode transaksi</p>
                  <p className="truncate font-mono text-base font-extrabold text-[#071a4f]">{transactionData.transaction_code || transactionData.id}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-[#071a4f] p-6 text-white md:p-7">
              <div>
                {completed ? <PackageCheck className="h-8 w-8 text-white/80" /> : <ReceiptText className="h-8 w-8 text-white/80" />}
                <p className="mt-5 text-sm font-bold text-white/65">Total pembayaran</p>
                <p className="mt-1 text-3xl font-extrabold">{formatCurrency(transactionData.total_amount)}</p>
                <p className="mt-2 text-xs font-medium text-white/60">{transactionData.total_item} item {completed ? "telah diterima" : "dalam pesanan"}</p>
              </div>
              <div className="mt-8 space-y-2">
                {isDoku ? <>
                  <Button className="commerce-orange-button min-h-11 w-full rounded-md font-extrabold" disabled={isDownloading} onClick={() => void downloadInvoice()}>
                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isDownloading ? "Menyiapkan invoice..." : "Unduh invoice PDF"}
                  </Button>
                  {downloadError ? <p role="alert" className="rounded-md bg-white/10 p-3 text-sm text-white">{downloadError}</p> : null}
                </> : null}
                <Button asChild className="commerce-orange-button h-11 w-full rounded-md font-extrabold">
                  <Link to="/commerce">
                    <ShoppingBag className="h-4 w-4" />
                    Belanja lagi
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="h-10 w-full rounded-md text-white/80 hover:bg-white/10 hover:text-white">
                  <Link to={`/${locationCode}/commerce/payment/${transactionId}${isDoku ? "?view=order" : ""}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Lihat detail transaksi
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="commerce-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-5">
            <div>
              <h2 className="font-extrabold text-[#071a4f]">Item pesanan</h2>
              <p className="text-xs font-medium text-slate-500">{completed ? "Ringkasan produk yang diterima" : "Ringkasan produk yang dipesan"}</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{items.length} produk</span>
          </div>

          {items.length > 0 ? (
            <div className="divide-y divide-slate-100 px-4 md:px-5">
              {items.map((item, index) => (
                <div key={item.id || `${item.product_stock_id}-${index}`} className="flex items-center gap-3 py-4">
                  <div className="commerce-product-visual flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200">
                    {item.product_details?.image_path ? (
                      <img
                        src={resolveAssetUrl(item.product_details.image_path)}
                        alt={item.product_details.product_name || "Produk"}
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : (
                      <ImageOff className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-extrabold text-[#071a4f]">
                      {item.product_details?.product_name || `Produk #${item.product_stock_id}`}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{item.qty} item</p>
                  </div>
                  <p className="text-sm font-extrabold text-[#071a4f]">{formatCurrency(item.amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Detail produk tidak tersedia.</p>
          )}

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 md:px-5">
            <div className="ml-auto max-w-sm space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-bold">{formatCurrency(transactionData.base_amount)}</span></div>
              {transactionData.payment_provider !== "DOKU" && <div className="flex justify-between text-sm"><span className="text-slate-500">Kode unik</span><span className="font-bold">{transactionData.payment_code || transactionData.nominal_code}</span></div>}
              <Separator />
              <div className="flex justify-between text-base font-extrabold text-[#071a4f]"><span>Total</span><span>{formatCurrency(transactionData.total_amount)}</span></div>
            </div>
          </div>
        </section>
      </div>
    </AppLayoutCommerce>
  );
}
