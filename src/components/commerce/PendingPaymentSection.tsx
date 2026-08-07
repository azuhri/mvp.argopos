import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  MapPin,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { usePendingPayments } from "@/hooks/usePendingPayments";
import { formatCurrency } from "@/lib/mockData";
import { Button } from "@/components/ui/button";

function formatRemainingTime(expiresAt: string, now: number): string {
  const seconds = Math.max(Math.floor((Date.parse(expiresAt) - now) / 1000), 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function PendingPaymentSection({
  locationCode,
}: {
  locationCode?: string;
}) {
  const { payments, isLoading, hasReconcileError, retry } =
    usePendingPayments(locationCode);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (payments.length === 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [payments.length]);

  const activePayments = useMemo(
    () => payments.filter((payment) => Date.parse(payment.expires_at) > now),
    [now, payments],
  );

  if (!isLoading && !hasReconcileError && activePayments.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="pending-payment-title"
      className="space-y-3 border-y border-slate-200 py-5"
      data-testid="pending-payment-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
            <ReceiptText className="h-5 w-5" />
          </span>
          <div>
            <h2
              id="pending-payment-title"
              className="text-lg font-extrabold text-[#071a4f]"
            >
              Pembayaran tertunda
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Transaksi aktif yang belum diselesaikan
            </p>
          </div>
        </div>

        {hasReconcileError && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-md font-bold"
            onClick={() => void retry()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Coba lagi
          </Button>
        )}
      </div>

      {hasReconcileError && (
        <p role="status" className="text-sm font-medium text-amber-800">
          Sebagian status pembayaran belum dapat diperbarui. Katalog tetap dapat digunakan.
        </p>
      )}

      {activePayments.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {activePayments.map((payment) => (
            <article
              key={payment.transaction_id}
              className="commerce-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              data-testid={`pending-payment-${payment.transaction_id}`}
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-extrabold text-amber-800">
                    Menunggu pembayaran
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {payment.transaction_code}
                  </span>
                </div>
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#071a4f]">
                  <MapPin className="h-4 w-4 shrink-0 text-[#e30613]" />
                  <span className="truncate">{payment.location_name}</span>
                </p>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                  <p className="text-lg font-extrabold text-[#071a4f]">
                    {formatCurrency(payment.total_amount)}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-sm font-extrabold text-[#e30613]">
                    <Clock3 className="h-4 w-4" />
                    {formatRemainingTime(payment.expires_at, now)}
                  </p>
                </div>
              </div>

              <Button
                asChild
                className="commerce-orange-button h-11 shrink-0 rounded-md px-4 font-extrabold"
              >
                <Link
                  to={`/${payment.location_code}/commerce/payment/${payment.transaction_id}`}
                >
                  Lanjutkan pembayaran
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
