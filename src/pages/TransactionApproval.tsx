import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Package } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api";
import type { Transaction } from "@/lib/api";

export default function TransactionApproval() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!transactionId) {
      setError("Transaction ID is required");
      setLoading(false);
      return;
    }

    fetchTransaction();
  }, [transactionId]);

  const fetchTransaction = async () => {
    try {
      const response = await apiClient.getTransaction(transactionId!);
      if (response.success && response.data) {
        setTransaction(response.data);
        // After fetching, proceed with approval
        approvePayment(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch transaction:", err);
      setError("Transaction not found");
      setLoading(false);
    }
  };

  const approvePayment = async (tx?: Transaction) => {
    try {
      await apiClient.approveTransactionPayment(transactionId!);
      if (tx) setTransaction(tx);
      setSuccess(true);
      toast.success("Payment approved successfully");
    } catch (err) {
      setError("Failed to approve payment. The transaction may not exist or is already approved.");
      toast.error("Failed to approve payment");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard/transactions");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 text-center"
        >
          {loading ? (
            <>
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <h2 className="text-xl font-semibold">Processing Approval...</h2>
                <p className="text-muted-foreground">Please wait while we process the payment approval.</p>
              </div>
              {transaction && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Transaction Code</span>
                  </div>
                  <p className="font-mono font-semibold text-lg">{transaction.transaction_code}</p>
                  <div className="pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Customer</span>
                    <p className="font-medium">{transaction.customer_name || "N/A"}</p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <p className="font-semibold text-primary">{formatCurrency(transaction.total_amount)}</p>
                  </div>
                </div>
              )}
            </>
          ) : success ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-green-600">Payment Approved!</h2>
              <div className="w-full p-4 bg-green-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction Code</span>
                  <span className="font-mono font-medium">{transaction?.transaction_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span className="font-medium">{transaction?.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-semibold text-green-600">{transaction && formatCurrency(transaction.total_amount)}</span>
                </div>
              </div>
              <Button onClick={handleGoToDashboard} className="w-full mt-4">
                Go to Transactions
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-red-600">Approval Failed</h2>
              <p className="text-muted-foreground">
                {error || "An error occurred while approving the payment."}
              </p>
              <div className="flex gap-2 w-full mt-4">
                <Button variant="outline" onClick={() => window.location.reload()} className="flex-1">
                  Retry
                </Button>
                <Button onClick={handleGoToDashboard} className="flex-1">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </GlassCard>
    </div>
  );
}
