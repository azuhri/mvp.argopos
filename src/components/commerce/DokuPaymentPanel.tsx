import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/mockData";
import { PaymentRequestError, paymentService, validatedCheckoutUrl } from "@/lib/services/paymentService";
import { getDokuPaymentMethodLabel } from "@/lib/dokuPaymentMethods";

interface DokuPaymentPanelProps {
  transactionId: string;
  returnMode?: boolean;
  onVerifiedPaid?: () => void;
}

export function DokuPaymentPanel({ transactionId, returnMode, onVerifiedPaid }: DokuPaymentPanelProps) {
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const refreshing = useRef(false);
  const [now, setNow] = useState(Date.now());
  const [actionError, setActionError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const returned = returnMode ?? new URLSearchParams(window.location.search).has("doku_return");
  const queryKey = ["doku-payment", transactionId];
  const statusQuery = useQuery({
    queryKey,
    // A reopened order may have no return marker. Verify its existing attempt
    // too; a GET alone only observes notifications already stored by the API.
    // One Query owns the whole check, including cancellation and deduplication.
    queryFn: async ({ signal }) => {
      if (returned) return (await paymentService.refreshStatus(transactionId, signal)).session;
      const latest = await paymentService.getStatus(transactionId, signal);
      if (latest.payment_id && latest.status === "PENDING" && !latest.review_required && !refreshing.current) {
        return (await paymentService.refreshStatus(transactionId, signal)).session;
      }
      return latest;
    },
    // Retry on the next polling tick, without additional immediate POSTs.
    retry: false,
    refetchInterval: (query) => {
      if (query.state.error instanceof PaymentRequestError && [401, 403, 404].includes(query.state.error.status)) return false;
      const data = query.state.data;
      if (data && (data.status !== "PENDING" || data.review_required)) return false;
      return 5000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const createMutation = useMutation({ mutationFn: (rejectedPaymentId?: string) => paymentService.createCheckout(transactionId, rejectedPaymentId) });
  const refreshMutation = useMutation({ mutationFn: () => paymentService.refreshStatus(transactionId) });
  const session = statusQuery.data;
  const expired = Boolean(session?.expires_at && Date.parse(session.expires_at) <= now);
  const paid = session?.status === "PAID";
  const verificationPending = Boolean(session?.verification_pending || session?.creation_state === "UNCERTAIN" || session?.creation_state === "CREATING");
  const reviewRequired = Boolean(session?.review_required);
  const terminal = session && session.status !== "PENDING";
  const canRetry = session?.status === "FAILED" && session.creation_state === "REJECTED" && Boolean(session.payment_id) && !expired;
  const ownershipDenied = [statusQuery.error, refreshMutation.error].some((error) => error instanceof PaymentRequestError && [401, 403].includes(error.status));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (paid) void queryClient.invalidateQueries({ queryKey: ["transaction", transactionId], exact: true });
  }, [paid, queryClient, transactionId]);
  useEffect(() => {
    if (paid && !reviewRequired && !statusQuery.isFetching && !statusQuery.error) onVerifiedPaid?.();
  }, [paid, reviewRequired, statusQuery.isFetching, statusQuery.error, onVerifiedPaid]);

  const openCheckout = async () => {
    if (submitting.current || refreshing.current || ownershipDenied || !session || (terminal && !canRetry) || expired || verificationPending || reviewRequired) return;
    submitting.current = true;
    setActionError("");
    try {
      // Recheck before opening a previously issued URL; a notification may have arrived.
      const latest = await statusQuery.refetch();
      if (latest.error || !latest.data) throw latest.error || new Error("Status pembayaran belum tersedia.");
      const retryRejected = latest.data.status === "FAILED" && latest.data.creation_state === "REJECTED" && Boolean(latest.data.payment_id);
      if ((latest.data.status !== "PENDING" && !retryRejected) || latest.data.review_required || latest.data.verification_pending || ["CREATING", "UNCERTAIN"].includes(latest.data.creation_state || "") || Date.parse(latest.data.expires_at) <= Date.now()) return;
      const payment = latest.data.checkout_url && !retryRejected ? latest.data : await createMutation.mutateAsync(retryRejected ? latest.data.payment_id : undefined);
      queryClient.setQueryData(queryKey, payment);
      if (payment.status === "PENDING" && payment.checkout_url && !payment.verification_pending && !payment.review_required && Date.parse(payment.expires_at) > Date.now()) {
        window.location.assign(validatedCheckoutUrl(payment.checkout_url));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Pembayaran belum dapat dibuka.");
      void statusQuery.refetch();
    } finally { submitting.current = false; }
  };

  const refreshStatus = async () => {
    if (refreshing.current || submitting.current || statusQuery.isFetching) return;
    refreshing.current = true;
    setActionError("");
    setRefreshMessage("");
    try {
      if (!session || returned) {
        await statusQuery.refetch();
        return;
      }
      const result = await refreshMutation.mutateAsync();
      queryClient.setQueryData(queryKey, result.session);
      if (result.session.status !== "PAID") {
        setRefreshMessage(result.checked
          ? "Status pembayaran telah diperiksa. Jika sudah membayar, tunggu konfirmasi sebelum mencoba kembali."
          : "Belum ada konfirmasi baru. Tunggu sebentar lalu periksa kembali. Jika sudah membayar, jangan bayar ulang.");
      }
      // A new PAID transition refreshes the transaction through the effect above.
      // Other responses (including an already-paid review) refresh it here.
      if (result.session.status !== "PAID" || paid) {
        void queryClient.invalidateQueries({ queryKey: ["transaction", transactionId], exact: true });
      }
      await queryClient.invalidateQueries({ queryKey, exact: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Status pembayaran belum dapat diperiksa. Coba kembali sebentar lagi.");
      void statusQuery.refetch();
    } finally {
      refreshing.current = false;
    }
  };

  const title = reviewRequired ? "Pembayaran perlu ditinjau" : paid ? "Pembayaran berhasil" : session?.status === "EXPIRED" ? "Pembayaran kedaluwarsa" : session?.status === "FAILED" ? "Pembayaran belum berhasil" : verificationPending || (returned && !paid) ? "Menunggu verifikasi pembayaran" : expired ? "Waktu pembayaran berakhir" : "Pembayaran DOKU";

  return (
    <section className="commerce-panel space-y-4 p-4 md:p-5" aria-label="Pembayaran DOKU">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-slate-100 p-2 text-[#071a4f]">{paid ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</span>
        <div className="min-w-0"><h2 className="font-extrabold text-[#071a4f]">{title}</h2><p className="mt-1 text-sm text-slate-600">{verificationPending || paid || reviewRequired || returned ? "Pantau konfirmasi pembayaran pesanan Anda." : "Pilih metode pembayaran yang tersedia di halaman DOKU."}</p></div>
      </div>
      {statusQuery.isPending ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Memeriksa status pembayaran...</p> : null}
      {statusQuery.error ? <p role="alert" className="text-sm text-red-700">{statusQuery.error.message}</p> : null}
      {session ? <>
        <dl className="space-y-2 rounded-md bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3"><dt>Total pembayaran</dt><dd className="font-extrabold">{formatCurrency(session.amount)}</dd></div>
          {session.invoice_number ? <div className="flex justify-between gap-3"><dt>Referensi</dt><dd className="break-all text-right font-mono text-xs">{session.invoice_number}</dd></div> : null}
          {session.channel || session.doku_payment_method ? <div className="flex justify-between gap-3"><dt>Metode</dt><dd>{getDokuPaymentMethodLabel(session.channel || session.doku_payment_method!)}</dd></div> : null}
        </dl>
        <p role="status" className="text-sm leading-relaxed text-slate-600">
          {reviewRequired ? `${paid ? "Pembayaran telah diterima dan sedang diperiksa admin." : "Admin sedang memeriksa pembayaran ini."} Jangan melakukan pembayaran ulang; hubungi outlet dengan kode transaksi Anda.` : paid ? "Pembayaran telah dikonfirmasi. Status penyiapan pesanan tersedia pada detail transaksi." : session.status === "EXPIRED" || expired ? "Waktu pembayaran telah berakhir. Hubungi outlet jika dana sudah terpotong; jangan membayar ulang." : session.status === "FAILED" ? canRetry && !returned ? "Sesi sebelumnya tidak berhasil dibuat. Anda dapat mencoba kembali untuk pesanan yang sama." : "Pembayaran belum berhasil. Hubungi outlet untuk bantuan jika dana sudah terpotong." : returned || session.payment_id ? "Pembayaran diperiksa otomatis setiap 5 detik. Halaman sukses akan terbuka setelah pembayaran dikonfirmasi. Jangan membayar ulang." : verificationPending ? "Status diperbarui otomatis setelah konfirmasi pembayaran diterima. Jika sudah membayar, tunggu konfirmasi sebelum mencoba kembali." : "Anda akan diarahkan ke halaman pembayaran DOKU untuk menyelesaikan pesanan ini."}
        </p>
        {!returned && (!terminal || canRetry) && !expired && !verificationPending && !reviewRequired && !statusQuery.error && !ownershipDenied ? <Button className="commerce-orange-button min-h-11 w-full" disabled={createMutation.isPending || refreshMutation.isPending || statusQuery.isFetching} onClick={() => void openCheckout()}>
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {createMutation.isPending ? "Menyiapkan pembayaran..." : canRetry ? "Coba pembayaran kembali" : session.checkout_url ? "Lanjutkan ke DOKU" : "Bayar melalui DOKU"}
        </Button> : null}
      </> : null}
      {actionError ? <p role="alert" className="text-sm text-red-700">{actionError}</p> : null}
      {refreshMessage && !paid ? <p role="status" className="text-sm text-slate-600">{refreshMessage}</p> : null}
      {returned && !terminal && !reviewRequired && !ownershipDenied && !statusQuery.error ? <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Menunggu konfirmasi DOKU...</p> : null}
      {(!returned || terminal || statusQuery.error) && (!paid || reviewRequired) ? <Button variant="outline" className="min-h-10 w-full" disabled={ownershipDenied || statusQuery.isFetching || createMutation.isPending || refreshMutation.isPending} onClick={() => void refreshStatus()}><RefreshCw className={`h-4 w-4 ${statusQuery.isFetching || refreshMutation.isPending ? "animate-spin" : ""}`} />{refreshMutation.isPending || (returned && statusQuery.isFetching) ? "Memeriksa pembayaran..." : "Periksa status pembayaran"}</Button> : null}
    </section>
  );
}
