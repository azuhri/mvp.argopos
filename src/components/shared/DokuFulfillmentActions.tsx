import { useRef, useState } from "react";
import { Camera, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { transactionService } from "@/lib/services/transactionService";
import type { Transaction } from "@/lib/api";

interface Props {
  transaction: Pick<Transaction, "id" | "status" | "payment_provider" | "path_proof_pickup">;
  onUpdated: () => void;
  onUpload: () => void;
  className?: string;
}

export function DokuFulfillmentActions({ transaction, onUpdated, onUpload, className }: Props) {
  const { canWrite } = useAuth();
  const inFlight = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const writable = canWrite("transactions");
  if (transaction.payment_provider !== "DOKU") return null;

  const prepare = async () => {
    if (inFlight.current || !writable) return;
    inFlight.current = true;
    setPreparing(true);
    try {
      await transactionService.approveDelivery(transaction.id);
      toast.success("Pesanan mulai disiapkan. Unggah bukti setelah barang siap diambil.");
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Persiapan pesanan belum dapat dimulai.");
    } finally {
      inFlight.current = false;
      setPreparing(false);
    }
  };

  if (transaction.status === "PAID") {
    return <Button size="sm" variant="outline" className={className} disabled={!writable || preparing} onClick={() => void prepare()}>
      {preparing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Package className="mr-1 h-3 w-3" />}
      {preparing ? "Memproses..." : "Mulai persiapan"}
    </Button>;
  }
  if (["PREPARING_PRODUCT", "READY_TO_PICKUP", "COMPLETED"].includes(transaction.status) && !transaction.path_proof_pickup) {
    return <Button size="sm" className={className} disabled={!writable} onClick={onUpload}>
      <Camera className="mr-1 h-3 w-3" />Upload Bukti
    </Button>;
  }
  return null;
}
