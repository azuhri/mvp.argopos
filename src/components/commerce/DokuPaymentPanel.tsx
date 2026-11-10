import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/mockData";
import { checkoutCreationFailed, DOKU_MAINTENANCE_MESSAGE, clearCheckoutRecovery, hasCheckoutRecovery, openDokuCheckout, PaymentRequestError, paymentService, validatedCheckoutUrl, type PaymentSession } from "@/lib/services/paymentService";
import { getDokuPaymentMethodLabel } from "@/lib/dokuPaymentMethods";
import { PaymentMaintenanceView } from "./PaymentMaintenanceView";

interface DokuPaymentPanelProps {
  transactionId: string;
  returnMode?: boolean;
  onVerifiedPaid?: () => void;
  onMaintenance?: () => void;
  presentation?: "payment" | "maintenance";
  catalogHref?: string;
}

function checkoutActions(session: PaymentSession | undefined, now: number) {
  const blocked = !session || session.review_required || session.verification_pending || ["CREATING", "UNCERTAIN"].includes(session.creation_state || "");
  const rejected = session?.status === "FAILED" && session.creation_state === "REJECTED" && Boolean(session.payment_id);
  const uninitiated = session?.status === "PENDING" && !session.payment_id;
  // Retry eligibility belongs to the server. The prior attempt can have an
  // earlier expiry than the order; only the order deadline governs a replacement.
  const retryTimeLeft = session?.checkout_retry_expires_at ? Date.parse(session.checkout_retry_expires_at) - now : 0;
  const canCreate = !blocked && session?.can_retry_checkout === true && (uninitiated || rejected) && retryTimeLeft >= 60000;
  const canResume = !blocked && session?.status === "PENDING" && Boolean(session.checkout_url) && Date.parse(session.expires_at) > now;
  const canReplay = !session?.review_required && session?.status === "PENDING" &&
    ["CREATING", "UNCERTAIN"].includes(session.creation_state || "") && session.can_resume_checkout === true &&
    retryTimeLeft >= 60000 && Date.parse(session.expires_at) > now;
  return { canCreate, canResume, canReplay, canRetry: canCreate && rejected, rejected };
}

function canRecoverReadyCheckout(transactionId: string, session: PaymentSession): boolean {
  if (!hasCheckoutRecovery(transactionId) || session.creation_state !== "READY" || !checkoutActions(session, Date.now()).canResume) return false;
  try { validatedCheckoutUrl(session.checkout_url!); return true; }
  catch { return false; }
}

export function DokuPaymentPanel({ transactionId, returnMode, onVerifiedPaid, onMaintenance, presentation = "payment", catalogHref }: DokuPaymentPanelProps) {
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const refreshing = useRef(false);
  const [now, setNow] = useState(Date.now());
  const [actionError, setActionError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const returned = returnMode ?? new URLSearchParams(window.location.search).has("doku_return");
  const needsMaintenance = (payment: PaymentSession) => checkoutCreationFailed(payment) || (
    hasCheckoutRecovery(transactionId) && !payment.review_required && payment.status === "PENDING" &&
    !payment.checkout_url && ["CREATING", ""].includes(payment.creation_state || "")
  );
  const queryKey = ["doku-payment", transactionId];
  const statusQuery = useQuery({
    queryKey,
    // A reopened order may have no return marker. Verify its existing attempt
    // too; a GET alone only observes notifications already stored by the API.
    // One Query owns the whole check, including cancellation and deduplication.
    queryFn: async ({ signal }) => {
      const latest = await paymentService.getStatus(transactionId, signal);
      // Notifications may already have confirmed payment, including on return.
      // Read canonical status first so PAID never depends on another provider check.
      // A lost creation response can already have a usable READY URL. Provider
      // checks are age/lease limited and may report verification_pending while
      // deferred, so recovering that URL must use the canonical owned GET.
      if (canRecoverReadyCheckout(transactionId, latest) || (presentation === "maintenance" && checkoutActions(latest, Date.now()).canResume)) return latest;
      // Move failed initialization out of payment detail immediately. The
      // maintenance page owns the existing attempt's subsequent reconciliation.
      if (onMaintenance && needsMaintenance(latest)) return latest;
      const checkProvider = latest.status === "PENDING" && (returned || Boolean(latest.payment_id));
      if (checkProvider && !latest.review_required && !refreshing.current && !submitting.current) {
        return (await paymentService.refreshStatus(transactionId, signal)).session;
      }
      return latest;
    },
    // Retry on the next polling tick, without additional immediate POSTs.
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
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
  const creationFailed = Boolean(session && checkoutCreationFailed(session));
  const maintenanceRequired = Boolean(session && needsMaintenance(session));
  const verificationPending = Boolean(session?.verification_pending || session?.creation_state === "UNCERTAIN" || session?.creation_state === "CREATING");
  const reviewRequired = Boolean(session?.review_required);
  const terminal = session && session.status !== "PENDING";
  const { canCreate, canResume, canRetry, rejected } = checkoutActions(session, now);
  const recoveringCheckout = hasCheckoutRecovery(transactionId);
  const showCheckout = canRetry || (!returned && canCreate) || (canResume && (!returned || recoveringCheckout));
  const ownershipDenied = [statusQuery.error, refreshMutation.error].some((error) => error instanceof PaymentRequestError && [401, 403].includes(error.status));
  const maintenanceRetry = presentation === "maintenance" && !paid && !reviewRequired &&
    (!session || session.status === "PENDING" || (session.status === "FAILED" && rejected)) &&
    (!session?.checkout_retry_expires_at || Date.parse(session.checkout_retry_expires_at) > now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (paid) {
      clearCheckoutRecovery(transactionId);
      void queryClient.invalidateQueries({ queryKey: ["transaction", transactionId], exact: true });
    }
  }, [paid, queryClient, transactionId]);
  useEffect(() => {
    if (session?.transaction_status) {
      void queryClient.invalidateQueries({ queryKey: ["transaction", transactionId], exact: true });
    }
  }, [session?.transaction_status, queryClient, transactionId]);
  useEffect(() => {
    if (paid && !reviewRequired && !statusQuery.isFetching && !statusQuery.error) onVerifiedPaid?.();
  }, [paid, reviewRequired, statusQuery.isFetching, statusQuery.error, onVerifiedPaid]);
  useEffect(() => {
    if (maintenanceRequired && !statusQuery.isFetching && !statusQuery.error) onMaintenance?.();
  }, [maintenanceRequired, statusQuery.isFetching, statusQuery.error, onMaintenance]);

  const openCheckout = async () => {
    if (submitting.current || refreshing.current || ownershipDenied || (!showCheckout && !maintenanceRetry)) return;
    submitting.current = true;
    setOpeningCheckout(true);
    setActionError("");
    setRefreshMessage("");
    try {
      // Recheck before opening a previously issued URL; a notification may have arrived.
      await queryClient.cancelQueries({ queryKey, exact: true });
      let latest = await paymentService.getStatus(transactionId);
      let actions = checkoutActions(latest, Date.now());
      if (maintenanceRetry && !actions.canCreate && !actions.canResume && !actions.canReplay && latest.status === "PENDING" && !latest.review_required) {
        latest = (await refreshMutation.mutateAsync()).session;
        actions = checkoutActions(latest, Date.now());
      }
      queryClient.setQueryData(queryKey, latest);
      if (!actions.canCreate && !actions.canResume && !actions.canReplay) {
        setRefreshMessage("Permintaan pembayaran sebelumnya masih diperiksa atau belum dapat diajukan ulang. Silakan coba beberapa saat lagi; jangan membuat pesanan baru untuk pembayaran yang sama.");
        return;
      }
      const payment = actions.canResume ? latest : await createMutation.mutateAsync(actions.canRetry || actions.canReplay ? latest.payment_id : undefined);
      queryClient.setQueryData(queryKey, payment);
      if (payment.status === "PENDING" && payment.creation_state === "READY" && payment.checkout_url && !payment.verification_pending && !payment.review_required && Date.parse(payment.expires_at) > Date.now()) {
        openDokuCheckout(transactionId, payment.checkout_url);
      } else if (payment.status !== "PAID") {
        setRefreshMessage("Pembayaran belum berhasil disiapkan. Silakan ajukan ulang beberapa saat lagi.");
      }
    } catch (error) {
      const accessError = error instanceof PaymentRequestError && [401, 403, 404].includes(error.status);
      setActionError(accessError ? error.message : DOKU_MAINTENANCE_MESSAGE);
      if (!accessError) onMaintenance?.();
      void statusQuery.refetch();
    } finally { submitting.current = false; setOpeningCheckout(false); }
  };

  const refreshStatus = async () => {
    if (refreshing.current || submitting.current || statusQuery.isFetching) return;
    refreshing.current = true;
    setActionError("");
    setRefreshMessage("");
    try {
      if (!session) {
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

  const title = reviewRequired ? "Pembayaran perlu ditinjau" : paid ? "Pembayaran berhasil" : session?.status === "EXPIRED" ? "Pembayaran kedaluwarsa" : creationFailed || rejected ? "Pembayaran DOKU belum dapat dibuat" : session?.status === "FAILED" ? "Pembayaran belum berhasil" : verificationPending || (returned && !paid && !showCheckout) ? "Menunggu verifikasi pembayaran" : expired ? "Waktu pembayaran berakhir" : "Pembayaran DOKU";

  if (presentation === "maintenance") {
    const busy = openingCheckout || statusQuery.isFetching || createMutation.isPending || refreshMutation.isPending;
    const message = reviewRequired ? "Pembayaran ini sedang diperiksa admin outlet. Jangan membayar ulang."
      : paid ? "Pembayaran telah dikonfirmasi. Halaman pembayaran berhasil akan terbuka."
      : canResume ? "Sesi pembayaran berhasil dipulihkan. Anda dapat melanjutkan pembayaran untuk pesanan yang sama."
      : DOKU_MAINTENANCE_MESSAGE;
    const heading = reviewRequired ? "Pembayaran perlu ditinjau" : paid ? "Pembayaran telah dikonfirmasi" : canResume ? "Pembayaran siap dilanjutkan" : undefined;
    return <PaymentMaintenanceView catalogHref={catalogHref} title={heading} message={message}>
      {statusQuery.error && <p role="alert" className="text-sm text-red-700">{statusQuery.error.message}</p>}
      {(showCheckout || maintenanceRetry) && !ownershipDenied && <Button className="commerce-orange-button min-h-11 w-full" disabled={busy} onClick={() => void openCheckout()}>
        {openingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {openingCheckout ? "Menyiapkan pembayaran..." : canResume ? "Buka pembayaran DOKU" : "Ajukan ulang pembayaran"}
      </Button>}
      {(!paid || reviewRequired) && <Button variant="outline" className="min-h-11 w-full" disabled={ownershipDenied || busy} onClick={() => void refreshStatus()}>
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Memeriksa pembayaran..." : "Periksa status pembayaran"}
      </Button>}
      {actionError && actionError !== DOKU_MAINTENANCE_MESSAGE && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
      {refreshMessage && !paid && <p role="status" className="text-sm text-slate-600">{refreshMessage}</p>}
    </PaymentMaintenanceView>;
  }

  return (
    <section className="commerce-panel space-y-4 p-4 md:p-5" aria-label="Pembayaran DOKU">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-slate-100 p-2 text-[#071a4f]">{paid ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</span>
        <div className="min-w-0"><h2 className="font-extrabold text-[#071a4f]">{title}</h2><p className="mt-1 text-sm text-slate-600">{verificationPending || paid || reviewRequired || returned ? "Pantau konfirmasi pembayaran pesanan Anda." : "Pilih metode pembayaran yang tersedia di halaman DOKU."}</p></div>
      </div>
      {statusQuery.isPending ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Memeriksa status pembayaran...</p> : null}
      {statusQuery.error ? <p role="alert" className="text-sm text-red-700">{statusQuery.error.message}</p> : null}
      {creationFailed ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">{DOKU_MAINTENANCE_MESSAGE}</div> : null}
      {session ? <>
        <dl className="space-y-2 rounded-md bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3"><dt>Total pembayaran</dt><dd className="font-extrabold">{formatCurrency(session.amount)}</dd></div>
          {session.invoice_number ? <div className="flex justify-between gap-3"><dt>Referensi</dt><dd className="break-all text-right font-mono text-xs">{session.invoice_number}</dd></div> : null}
          {session.channel || session.doku_payment_method ? <div className="flex justify-between gap-3"><dt>Metode</dt><dd>{getDokuPaymentMethodLabel(session.channel || session.doku_payment_method!)}</dd></div> : null}
        </dl>
        <p role="status" className="text-sm leading-relaxed text-slate-600">
          {reviewRequired ? `${paid ? "Pembayaran telah diterima dan sedang diperiksa admin." : "Admin sedang memeriksa pembayaran ini."} Jangan melakukan pembayaran ulang; hubungi outlet dengan kode transaksi Anda.` : paid ? "Pembayaran telah dikonfirmasi. Status penyiapan pesanan tersedia pada detail transaksi." : canRetry ? "Sesi pembayaran sebelumnya gagal dibuat. Coba kembali untuk pesanan yang sama; Anda tidak perlu checkout ulang." : session.status === "EXPIRED" || expired ? "Waktu pembayaran telah berakhir. Hubungi outlet jika dana sudah terpotong; jangan membayar ulang." : rejected ? "Pesanan Anda tetap tersimpan, tetapi sesi pembayaran belum dapat dibuat kembali. Periksa status atau hubungi outlet." : session.status === "FAILED" ? "Pembayaran belum berhasil. Hubungi outlet untuk bantuan jika dana sudah terpotong." : canResume && recoveringCheckout ? "Sesi pembayaran pesanan ini berhasil dipulihkan. Buka pembayaran untuk melanjutkan di DOKU." : returned || session.payment_id ? "Pembayaran diperiksa otomatis setiap 5 detik. Halaman sukses akan terbuka setelah pembayaran dikonfirmasi. Jangan membayar ulang." : verificationPending ? "Status diperbarui otomatis setelah konfirmasi pembayaran diterima. Jika sudah membayar, tunggu konfirmasi sebelum mencoba kembali." : "Anda akan diarahkan ke halaman pembayaran DOKU untuk menyelesaikan pesanan ini."}
        </p>
        {showCheckout && !statusQuery.error && !ownershipDenied ? <Button className="commerce-orange-button min-h-11 w-full" disabled={createMutation.isPending || refreshMutation.isPending || statusQuery.isFetching} onClick={() => void openCheckout()}>
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {createMutation.isPending ? "Menyiapkan pembayaran..." : canRetry ? "Coba pembayaran kembali" : canResume && recoveringCheckout ? "Buka pembayaran DOKU" : session.checkout_url ? "Lanjutkan ke DOKU" : "Bayar melalui DOKU"}
        </Button> : null}
      </> : null}
      {actionError && !(creationFailed && actionError === DOKU_MAINTENANCE_MESSAGE) ? <p role="alert" className="text-sm text-red-700">{actionError}</p> : null}
      {refreshMessage && !paid ? <p role="status" className="text-sm text-slate-600">{refreshMessage}</p> : null}
      {returned && !terminal && !creationFailed && !showCheckout && !reviewRequired && !ownershipDenied && !statusQuery.error ? <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Menunggu konfirmasi DOKU...</p> : null}
      {(!returned || terminal || statusQuery.error) && (!paid || reviewRequired) ? <Button variant="outline" className="min-h-10 w-full" disabled={ownershipDenied || statusQuery.isFetching || createMutation.isPending || refreshMutation.isPending} onClick={() => void refreshStatus()}><RefreshCw className={`h-4 w-4 ${statusQuery.isFetching || refreshMutation.isPending ? "animate-spin" : ""}`} />{refreshMutation.isPending || (returned && statusQuery.isFetching) ? "Memeriksa pembayaran..." : "Periksa status pembayaran"}</Button> : null}
    </section>
  );
}
