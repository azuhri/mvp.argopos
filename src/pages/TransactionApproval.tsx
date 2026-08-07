import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, type Transaction } from "@/lib/api";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

export default function TransactionApproval() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransaction = useCallback(async () => {
    if (!transactionId) {
      setError("ID transaksi tidak tersedia.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getTransaction(transactionId);
      if (!response.success || !response.data) {
        throw new Error(response.message || "Transaksi tidak ditemukan.");
      }
      setTransaction(response.data);
    } catch (requestError) {
      setError((requestError as Error).message || "Transaksi tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    void fetchTransaction();
  }, [fetchTransaction]);

  const handleApprove = async () => {
    if (!transactionId || !transaction || transaction.status !== "WAITING_TO_PAYMENT") return;

    setApproving(true);
    setError(null);
    try {
      const response = await apiClient.approveTransactionPayment(transactionId);
      if (!response.success) {
        throw new Error(response.message || "Pembayaran gagal dikonfirmasi.");
      }
      setTransaction((current) => current ? { ...current, status: "PAID" } : current);
      toast.success("Pembayaran berhasil dikonfirmasi");
    } catch (requestError) {
      const message = (requestError as Error).message || "Pembayaran gagal dikonfirmasi.";
      setError(message);
      toast.error(message);
    } finally {
      setApproving(false);
    }
  };

  const isPaid = transaction?.status === "PAID";
  const canApprove = transaction?.status === "WAITING_TO_PAYMENT";

  return (
    <AppLayout title="Konfirmasi Pembayaran">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/transactions")}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Kembali ke transaksi
        </Button>

        <Card className="rounded-lg">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" />
                  Verifikasi pembayaran
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Periksa transaksi sebelum mengubah status pembayaran.
                </p>
              </div>
              {transaction ? (
                <Badge variant={isPaid ? "default" : canApprove ? "secondary" : "outline"}>
                  {transaction.status.replaceAll("_", " ")}
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            {loading ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                <p className="text-sm">Memuat transaksi...</p>
              </div>
            ) : error && !transaction ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
                <CircleAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="max-w-md text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={() => void fetchTransaction()}>
                  Muat ulang
                </Button>
              </div>
            ) : transaction ? (
              <div className="space-y-6">
                <dl className="grid gap-4 rounded-lg border border-border bg-muted/25 p-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Kode transaksi</dt>
                    <dd className="mt-1 break-all font-mono text-sm font-semibold">
                      {transaction.transaction_code || transaction.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Customer</dt>
                    <dd className="mt-1 text-sm font-semibold">{transaction.customer_name || "Customer"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Store</dt>
                    <dd className="mt-1 text-sm font-semibold">{transaction.location_name || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Total pembayaran</dt>
                    <dd className="mt-1 text-lg font-bold text-primary">
                      {formatCurrency(transaction.total_amount)}
                    </dd>
                  </div>
                </dl>

                {isPaid ? (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Pembayaran sudah dikonfirmasi</p>
                      <p className="mt-1 text-sm text-emerald-800">
                        Customer telah dijadwalkan menerima email detail transaksi.
                      </p>
                    </div>
                  </div>
                ) : canApprove ? (
                  <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-md text-sm text-muted-foreground">
                      Konfirmasi hanya setelah nominal dan bukti pembayaran sesuai.
                    </p>
                    <Button onClick={handleApprove} disabled={approving}>
                      {approving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Konfirmasi pembayaran
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Transaksi dengan status ini tidak dapat dikonfirmasi dari halaman approval.
                  </div>
                )}

                {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
