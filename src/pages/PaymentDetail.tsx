import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  ImageOff,
  MapPin,
  MessageCircle,
  Package,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Store,
  Wallet,
  XCircle,
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
import { toast } from "sonner";
import {
  readPendingPayments,
  removePendingPayment,
  upsertPendingPayment,
} from "@/lib/pendingPaymentStorage";
import {
  getRemainingPaymentSeconds,
  parsePaymentExpiry,
} from "@/lib/paymentExpiry";
import { getTransactionItemCount } from "@/lib/transactionPresentation";
import { DokuPaymentPanel } from "@/components/commerce/DokuPaymentPanel";

interface StoreAssignedUser {
  id: string;
  username: string;
  email: string;
  no_wa: string;
}

interface StoreData {
  location_id: string;
  location_name: string;
  location_code: string;
  assigned_users?: StoreAssignedUser[];
}

interface PaymentMethod {
  id: string;
  location_id: string;
  payment_type: string;
  image_url: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
}

interface TransactionCart {
  id: string;
  product_stock_id: string;
  amount: number;
  qty: number;
  product_details?: {
    product_name: string;
    image_path: string;
  };
}

interface Transaction {
  id: string;
  payment_provider?: string;
  master_location_id: string;
  customer_id: string;
  status: string;
  payment_code: string;
  payment_method_id: string;
  nominal_code: string;
  base_amount: number;
  total_amount: number;
  total_item: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  transaction_code?: string;
  transaction_carts?: TransactionCart[];
  path_proof_pickup?: string;
  pickup_at?: string;
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":");
}

function getPaymentMethodLabel(paymentType?: string) {
  if (paymentType === "qris") return "QRIS";
  if (paymentType === "transfer_rekening") return "Transfer Rekening";
  if (paymentType === "cutoff_hutang") return "Cutoff / Hutang";
  return "Metode pembayaran";
}

function resolveAssetUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${config.endpointUrl}/${path.replace(/^\/+/, "")}`;
}

function PaymentMethodIcon({ paymentType }: { paymentType?: string }) {
  if (paymentType === "qris") return <QrCode className="h-5 w-5" />;
  if (paymentType === "transfer_rekening") return <CreditCard className="h-5 w-5" />;
  if (paymentType === "cutoff_hutang") return <Wallet className="h-5 w-5" />;
  return <Banknote className="h-5 w-5" />;
}

function getStatusMessage(status: string, paymentProvider?: string) {
  if (paymentProvider === "DOKU") {
    if (status === "WAITING_TO_PAYMENT") return "Menunggu konfirmasi pembayaran DOKU. Jika sudah membayar, jangan bayar ulang.";
    if (status === "PAID") return "Pembayaran DOKU telah diterima. Periksa detail verifikasi di bawah.";
    if (status === "REJECTED") return "Pesanan telah dibatalkan. Periksa status pembayaran DOKU di bawah sebelum membuat pesanan baru.";
  }
  if (status === "WAITING_TO_PAYMENT") return "Selesaikan pembayaran sebelum waktu berakhir.";
  if (status === "PAID") return "Pembayaran sudah diverifikasi dan pesanan segera diproses.";
  if (status === "PREPARING_PRODUCT") return "Outlet sedang menyiapkan produk pesanan Anda.";
  if (status === "READY_TO_PICKUP") return "Pesanan siap diambil di outlet.";
  if (status === "COMPLETED") return "Pesanan telah diterima dan transaksi selesai.";
  return "Status transaksi diperbarui secara otomatis.";
}

function persistPendingTransaction(
  transaction: Transaction,
  storeData: StoreData,
  locationCode?: string,
  expiresAt = transaction.expires_at,
) {
  if (transaction.status !== "WAITING_TO_PAYMENT") return false;

  return upsertPendingPayment({
    transaction_id: transaction.id,
    transaction_code: transaction.transaction_code || transaction.id,
    location_code: storeData.location_code || locationCode || "",
    location_name: storeData.location_name,
    total_amount: Number(transaction.total_amount),
    status: "WAITING_TO_PAYMENT",
    created_at: transaction.created_at,
    expires_at: expiresAt || "",
  });
}

export default function PaymentDetail() {
  const { locationCode, transactionId } = useParams<{ locationCode: string; transactionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnMode = new URLSearchParams(location.search).has("doku_return");
  const viewOrder = new URLSearchParams(location.search).get("view") === "order";
  const handleVerifiedPaid = useCallback(() => {
    if (!viewOrder) navigate(`/${locationCode}/commerce/payment-success/${transactionId}`, { replace: true });
  }, [locationCode, transactionId, navigate, viewOrder]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSavingForLater, setIsSavingForLater] = useState(false);
  const [recoveryExpiry, setRecoveryExpiry] = useState<{
    transactionId: string;
    expiresAt?: string;
  } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [confirmedReceipt, setConfirmedReceipt] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const { data: storeData, isLoading: storeLoading } = useQuery({
    queryKey: ["store", locationCode],
    queryFn: async () => {
      const response = await fetch(`${config.apiUrl}/${locationCode}/store`);
      if (!response.ok) throw new Error("Failed to fetch store data");
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: Boolean(locationCode),
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ["paymentMethods", storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return [];
      const response = await fetch(`${config.apiUrl}/stores/${storeData.location_id}/payment-methods`);
      if (!response.ok) throw new Error("Failed to fetch payment methods");
      const result = await response.json();
      return result.data as PaymentMethod[];
    },
    enabled: Boolean(storeData?.location_id),
  });

  const { data: storeAssignedUsers } = useQuery({
    queryKey: ["storeAssignedUsers", storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return [];
      const response = await fetch(`${config.apiUrl}/stores/${storeData.location_id}/assigned-users`);
      if (!response.ok) throw new Error("Failed to fetch assigned users");
      const result = await response.json();
      return result.data as StoreAssignedUser[];
    },
    enabled: Boolean(storeData?.location_id),
  });

  const {
    data: transactionData,
    error: transactionError,
    isLoading: transactionLoading,
    refetch: refetchTransaction,
  } = useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const response = await fetch(`${config.apiUrl}/transactions/${transactionId}`);
      if (response.status === 404) removePendingPayment(transactionId);
      if (!response.ok) throw new Error("Gagal memuat data transaksi");
      const result = await response.json() as { data?: Transaction };
      if (!result.data || typeof result.data !== "object") {
        throw new Error("Respons transaksi tidak valid");
      }
      return result.data;
    },
    enabled: Boolean(transactionId),
    refetchInterval: (query) => {
      const transaction = query.state.data as Transaction | undefined;
      return transaction && ["REJECTED", "COMPLETED"].includes(transaction.status) ? false : 5000;
    },
  });
  const transactionStatus = transactionData?.status;
  const canonicalExpiresAt = parsePaymentExpiry(transactionData?.expires_at) === null
    ? undefined
    : transactionData?.expires_at;
  const transactionExpiresAt = canonicalExpiresAt || (
    recoveryExpiry?.transactionId === transactionId
      ? recoveryExpiry.expiresAt
      : undefined
  );

  useEffect(() => {
    if (!transactionId) {
      setRecoveryExpiry(null);
      return;
    }

    const pendingPayment = readPendingPayments().find(
      (item) => item.transaction_id === transactionId,
    );
    setRecoveryExpiry({
      transactionId,
      expiresAt: pendingPayment?.expires_at,
    });
  }, [transactionId]);

  useEffect(() => {
    if (!paymentMethods || !transactionData?.payment_method_id) return;
    setSelectedPaymentMethod(
      paymentMethods.find((method) => method.id === transactionData.payment_method_id) || null,
    );
  }, [paymentMethods, transactionData?.payment_method_id]);

  useEffect(() => {
    if (transactionStatus !== "WAITING_TO_PAYMENT") {
      setTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      setTimeLeft(getRemainingPaymentSeconds(transactionExpiresAt));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [transactionExpiresAt, transactionStatus]);

  useEffect(() => {
    if (!transactionData || !storeData) return;
    persistPendingTransaction(
      transactionData,
      storeData,
      locationCode,
      transactionExpiresAt,
    );
  }, [locationCode, storeData, transactionData, transactionExpiresAt]);

  useEffect(() => {
    if (!transactionId || !transactionStatus) return;

    if (transactionStatus !== "WAITING_TO_PAYMENT") {
      removePendingPayment(transactionId);
      return;
    }

    const expiresAt = parsePaymentExpiry(transactionExpiresAt);
    if (expiresAt === null) return;

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      removePendingPayment(transactionId);
      return;
    }

    const timeout = window.setTimeout(
      () => removePendingPayment(transactionId),
      Math.min(delay + 50, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [transactionExpiresAt, transactionId, transactionStatus]);

  const handlePayLater = async () => {
    if (!transactionData || !storeData) return;

    setIsSavingForLater(true);
    try {
      let transaction = transactionData;
      let expiresAt = transactionExpiresAt;

      if (parsePaymentExpiry(expiresAt) === null) {
        const refreshed = await refetchTransaction();
        if (refreshed.data) {
          transaction = refreshed.data;
          expiresAt = parsePaymentExpiry(refreshed.data.expires_at) === null
            ? expiresAt
            : refreshed.data.expires_at;
        }
      }

      if (transaction.status !== "WAITING_TO_PAYMENT") {
        toast.info("Status transaksi sudah berubah. Silakan periksa detail pembayaran terbaru.");
        return;
      }

      if (parsePaymentExpiry(expiresAt) === null) {
        toast.error("Batas waktu pembayaran belum tersedia. Coba lagi setelah data tersinkronisasi.");
        return;
      }

      const isPersisted = persistPendingTransaction(
        transaction,
        storeData,
        locationCode,
        expiresAt,
      );
      if (!isPersisted) {
        toast.error("Pembayaran tertunda belum dapat disimpan di browser ini.");
        return;
      }

      window.scrollTo({ top: 0, left: 0 });
      navigate(locationCode ? `/${locationCode}/commerce` : "/commerce");
    } finally {
      setIsSavingForLater(false);
    }
  };

  const handleSendToWA = (admin: StoreAssignedUser) => {
    if (!admin.no_wa || !transactionData) {
      toast.error("Nomor WhatsApp admin tidak tersedia");
      return;
    }

    const message = encodeURIComponent(
      `Halo ${admin.username}, saya ingin mengirim bukti pembayaran untuk transaksi ${transactionData.transaction_code || transactionData.id} di ${storeData?.location_name}. Total pembayaran ${formatCurrency(transactionData.total_amount)}. Mohon bantu verifikasi, terima kasih.`,
    );
    const waNumber = admin.no_wa.replace(/^0/, "62").replace(/\+/g, "");
    window.open(`https://wa.me/${waNumber}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleConfirmReceipt = async () => {
    if (!transactionId || transactionData?.payment_provider === "DOKU") return;
    setIsConfirmingReceipt(true);

    try {
      const response = await fetch(`${config.apiUrl}/transactions/${transactionId}/confirm-receipt`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Gagal mengkonfirmasi penerimaan barang");

      setConfirmedReceipt(true);
      toast.success("Penerimaan barang berhasil dikonfirmasi");
      window.setTimeout(() => {
        navigate(`/${locationCode}/commerce/payment-success/${transactionId}`);
      }, 1200);
    } catch {
      toast.error("Gagal mengkonfirmasi penerimaan barang");
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied((current) => ({ ...current, [key]: true }));
      toast.success("Berhasil disalin");
      window.setTimeout(() => setCopied((current) => ({ ...current, [key]: false })), 1800);
    } catch {
      toast.error("Tidak dapat menyalin data");
    }
  };

  const handleDownload = (url: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = url.split("/").pop() || "qris";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  if (storeLoading || transactionLoading) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      </AppLayoutCommerce>
    );
  }

  if (transactionError || !transactionData || !storeData) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-red-50 text-[#e30613]">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-[#071a4f]">Transaksi tidak dapat dimuat</h1>
          <p className="mt-2 text-sm text-slate-500">Periksa kembali tautan transaksi atau kembali ke katalog.</p>
          <Button asChild className="mt-6 rounded-md bg-[#071a4f] hover:bg-[#102866]">
            <Link to="/commerce">Kembali ke katalog</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  if (transactionData.status === "REJECTED" && transactionData.payment_provider !== "DOKU") {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
        <div className="mx-auto flex min-h-[65vh] max-w-lg items-center justify-center">
          <div className="commerce-panel w-full p-6 text-center md:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-md bg-red-50 text-[#e30613]">
              <XCircle className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#071a4f]">Transaksi dibatalkan</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Batas waktu pembayaran telah berakhir. Buat pesanan baru untuk melanjutkan pembelian.
            </p>
            <div className="mt-5 rounded-md bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-[#071a4f]">
              {transactionData.transaction_code || transactionData.id}
            </div>
            <Button asChild className="commerce-orange-button mt-6 h-11 w-full rounded-md font-extrabold">
              <Link to="/commerce">Kembali berbelanja</Link>
            </Button>
          </div>
        </div>
      </AppLayoutCommerce>
    );
  }

  const admins = storeAssignedUsers?.length ? storeAssignedUsers : storeData.assigned_users || [];
  const items = transactionData.transaction_carts || [];
  const totalItems = getTransactionItemCount(transactionData.total_item, items);
  const isWaiting = transactionData.status === "WAITING_TO_PAYMENT";
  const isDoku = transactionData.payment_provider === "DOKU";
  const isReadyToPickup = transactionData.status === "READY_TO_PICKUP";
  const qrisUrl = selectedPaymentMethod?.image_url
    ? selectedPaymentMethod.image_url.startsWith("http")
      ? selectedPaymentMethod.image_url
      : `${config.endpointUrl}/public/${selectedPaymentMethod.image_url.replace(/^\/+/, "")}`
    : "";

  return (
    <AppLayoutCommerce title={storeData.location_name} locationCode={locationCode || ""}>
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-3 -ml-3 rounded-md font-bold text-slate-600">
              <Link to="/commerce">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke katalog
              </Link>
            </Button>
            <h1 className="text-2xl font-extrabold text-[#071a4f] md:text-3xl">Detail pembayaran</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <MapPin className="h-4 w-4 text-[#e30613]" />
              {storeData.location_name}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
            <span>1. Keranjang</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#071a4f]">2. Pembayaran</span>
            <span aria-hidden="true">/</span>
            <span>3. Selesai</span>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`commerce-panel flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5 ${
            isWaiting ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${isWaiting ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {isWaiting ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold text-[#071a4f]">{getStatusMessage(transactionData.status, transactionData.payment_provider)}</p>
                <StatusBadge status={getStatusBadgeKey(transactionData.status)} />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-600">{isDoku ? "Status pembayaran dan pesanan diperbarui otomatis." : "Status diperbarui otomatis setiap 5 detik."}</p>
            </div>
          </div>
          {isWaiting && !(isDoku && returnMode) && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch">
              <div className="min-w-[168px] rounded-md border border-amber-200 bg-white px-4 py-3 text-left md:text-right">
                <p className="text-xs font-bold text-amber-700">Sisa waktu pembayaran</p>
                <p
                  className="mt-0.5 font-mono text-2xl font-extrabold text-[#e30613]"
                  data-testid="payment-countdown"
                >
                  {timeLeft === null ? "--:--:--" : formatTime(timeLeft)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-11 rounded-md border-amber-300 bg-white px-4 font-extrabold text-[#071a4f] hover:bg-amber-100"
                onClick={handlePayLater}
                disabled={isSavingForLater || (timeLeft !== null && timeLeft <= 0)}
              >
                {isSavingForLater ? <LoadingSpinner size="sm" /> : <ArrowLeft className="h-4 w-4" />}
                {isSavingForLater ? "Menyimpan..." : "Bayar nanti"}
              </Button>
            </div>
          )}
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {isDoku && <DokuPaymentPanel key={transactionData.id} transactionId={transactionData.id} returnMode={returnMode} onVerifiedPaid={handleVerifiedPaid} />}
            <section className="commerce-panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4 md:px-5">
                <Package className="h-5 w-5 text-[#e30613]" />
                <div>
                  <h2 className="font-extrabold text-[#071a4f]">Produk pesanan</h2>
                  <p className="text-xs font-medium text-slate-500" data-testid="transaction-item-count">
                    {totalItems} item dalam transaksi
                  </p>
                </div>
              </div>
              {items.length > 0 ? (
                <div className="divide-y divide-slate-100 px-4 md:px-5">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-4">
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
            </section>

            {!isDoku && <section className="commerce-panel p-4 md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#eef2fb] text-[#071a4f]">
                  <PaymentMethodIcon paymentType={selectedPaymentMethod?.payment_type} />
                </span>
                <div>
                  <h2 className="font-extrabold text-[#071a4f]">{getPaymentMethodLabel(selectedPaymentMethod?.payment_type)}</h2>
                  <p className="text-xs font-medium text-slate-500">Metode pembayaran transaksi</p>
                </div>
              </div>

              {!selectedPaymentMethod && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Detail metode pembayaran tidak tersedia. Hubungi admin outlet untuk bantuan.
                </div>
              )}

              {selectedPaymentMethod?.payment_type === "transfer_rekening" && (
                <dl className="divide-y divide-slate-100 rounded-md border border-slate-200 px-4">
                  <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Bank</dt><dd className="font-bold text-[#071a4f]">{selectedPaymentMethod.bank_name}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-3 text-sm">
                    <dt className="text-slate-500">Nomor rekening</dt>
                    <dd className="flex items-center gap-1 font-bold text-[#071a4f]">
                      {selectedPaymentMethod.account_number}
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => handleCopy("account", selectedPaymentMethod.account_number)} title="Salin nomor rekening">
                        {copied.account ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Atas nama</dt><dd className="font-bold text-[#071a4f]">{selectedPaymentMethod.account_name}</dd></div>
                </dl>
              )}

              {selectedPaymentMethod?.payment_type === "qris" && qrisUrl && (
                <div className="rounded-md border border-slate-200 bg-white p-4 text-center">
                  <img src={qrisUrl} alt="Kode QRIS pembayaran" className="mx-auto aspect-square w-full max-w-[280px] object-contain" />
                  <Button variant="outline" className="mt-4 rounded-md font-bold" onClick={() => handleDownload(qrisUrl)}>
                    <Download className="h-4 w-4" />
                    Unduh QRIS
                  </Button>
                </div>
              )}

              {selectedPaymentMethod?.payment_type === "cutoff_hutang" && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
                  Pembayaran dicatat melalui cutoff internal. Konfirmasikan penerimaan setelah barang diterima.
                </div>
              )}
            </section>}

            {!isDoku && admins.length > 0 && (
              <section className="commerce-panel p-4 md:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Store className="h-5 w-5 text-[#e30613]" />
                  <div>
                    <h2 className="font-extrabold text-[#071a4f]">Bantuan outlet</h2>
                    <p className="text-xs font-medium text-slate-500">Kirim bukti pembayaran melalui WhatsApp.</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {admins.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#071a4f]">{admin.username}</p>
                        <p className="truncate text-xs text-slate-500">{admin.no_wa || admin.email}</p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 rounded-md border-emerald-200 font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => handleSendToWA(admin)} disabled={!admin.no_wa}>
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside>
            <div className="commerce-panel sticky top-24 overflow-hidden">
              <div className="bg-[#071a4f] px-5 py-4 text-white">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-white/80" />
                  <h2 className="font-extrabold">Ringkasan transaksi</h2>
                </div>
                <p className="mt-1 text-xs font-medium text-white/65">{transactionData.transaction_code || transactionData.id}</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={getStatusBadgeKey(transactionData.status)} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Kode transaksi</span>
                  <span className="flex min-w-0 items-center gap-1 font-mono font-bold text-[#071a4f]">
                    <span className="truncate">{transactionData.transaction_code || transactionData.id}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => handleCopy("transaction", transactionData.transaction_code || transactionData.id)} title="Salin kode transaksi">
                      {copied.transaction ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Subtotal</span><span className="font-bold">{formatCurrency(transactionData.base_amount)}</span></div>
                {!isDoku && <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Kode unik</span><span className="font-bold">{transactionData.payment_code || transactionData.nominal_code}</span></div>}
                <Separator />
                <div>
                  <p className="text-xs font-bold text-slate-500">Total pembayaran</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-2xl font-extrabold text-[#071a4f]">{formatCurrency(transactionData.total_amount)}</p>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-md" onClick={() => handleCopy("total", transactionData.total_amount.toString())} title="Salin total pembayaran">
                      {copied.total ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {transactionData.path_proof_pickup && (
                  <div className="border-t border-slate-200 pt-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
                      <ShieldCheck className="h-4 w-4" />
                      Bukti serah terima
                    </div>
                    <img
                      src={resolveAssetUrl(transactionData.path_proof_pickup)}
                      alt="Bukti serah terima"
                      className="max-h-56 w-full rounded-md border border-slate-200 object-contain"
                    />
                  </div>
                )}

                {isReadyToPickup && !transactionData.path_proof_pickup && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                    Admin sedang menyiapkan bukti serah terima.
                  </div>
                )}

                {confirmedReceipt && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Penerimaan berhasil dikonfirmasi.
                  </div>
                )}

                {isDoku && ["PAID", "PREPARING_PRODUCT", "READY_TO_PICKUP"].includes(transactionData.status) && (
                  <Button asChild className="commerce-orange-button h-auto min-h-11 w-full rounded-md py-3 font-extrabold">
                    <Link to={`/${locationCode}/commerce/payment-success/${transactionId}`}><QrCode aria-hidden="true" className="h-4 w-4" /> Tampilkan QR penyerahan</Link>
                  </Button>
                )}

                {!isDoku && isReadyToPickup && !confirmedReceipt && (
                  <Button className="commerce-orange-button h-auto min-h-11 w-full rounded-md py-3 font-extrabold" onClick={handleConfirmReceipt} disabled={isConfirmingReceipt}>
                    {isConfirmingReceipt ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isConfirmingReceipt ? "Memproses..." : "Konfirmasi barang diterima"}
                  </Button>
                )}

              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppLayoutCommerce>
  );
}
