import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TransactionApproval() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) {
      setError("Transaction ID is required");
      setLoading(false);
      return;
    }

    approvePayment();
  }, [transactionId]);

  const approvePayment = async () => {
    try {
      // TODO: Call API to approve payment
      // await transactionService.approvePayment(transactionId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 text-center"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <h2 className="text-xl font-semibold">Processing Approval...</h2>
              <p className="text-muted-foreground">Please wait while we process the payment approval.</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-green-600">Payment Approved!</h2>
              <p className="text-muted-foreground">
                Transaction {transactionId?.slice(0, 8)}... payment has been successfully approved.
              </p>
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
