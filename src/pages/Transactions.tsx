import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PickupProofModal } from "@/components/shared/PickupProofUpload";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Check, Package, Camera, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient, Transaction } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/mockData";

export default function Transactions() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [searchTransaction, setSearchTransaction] = useState("");
  const [searchProduct, setSearchProduct] = useState("");

  // Modal state for pickup proof upload
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await apiClient.listTransactions({ page: 1, page_size: 100 });
      return response.data?.transactions || [];
    },
  });

  // Mark as Ready to Pickup mutation
  const markReadyMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return apiClient.request(`/transactions/${transactionId}/mark-ready-pickup`, { method: 'POST' });
    },
    onSuccess: () => {
      toast.success("Berhasil menandai siap diambil");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: () => {
      toast.error("Gagal menandai siap diambil");
    },
  });

  // Filter transactions
  const filteredTransactions = (transactionsData || []).filter((tx: Transaction) => {
    if (!searchTransaction) return true;
    const search = searchTransaction.toLowerCase();
    return (
      tx.transaction_code?.toLowerCase().includes(search) ||
      tx.customer_name?.toLowerCase().includes(search) ||
      tx.id?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle upload pickup proof - opens modal
  const handleUploadPickupProof = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setPickupModalOpen(true);
  };

  // Handle pickup proof success
  const handlePickupProofSuccess = () => {
    toast.success("Bukti penyerahan berhasil diupload");
    refetchTransactions();
    setPickupModalOpen(false);
    setSelectedTransaction(null);
  };

  // Handle mark as ready (after upload proof)
  const handleMarkReady = (transactionId: string) => {
    markReadyMutation.mutate(transactionId);
  };

  // Get action label based on status
  const getActionForStatus = (status: string, hasPickupProof: boolean) => {
    switch (status) {
      case 'PAID':
        return { label: 'Prepare', action: 'prepare' };
      case 'PREPARING_PRODUCT':
        if (!hasPickupProof) {
          return { label: 'Serah Terima', action: 'upload_proof' };
        }
        return { label: 'Siap Ambil', action: 'mark_ready' };
      case 'READY_TO_PICKUP':
        return { label: '✓ Selesai', action: 'completed' };
      case 'COMPLETED':
        return { label: '✓ Selesai', action: 'completed' };
      default:
        return null;
    }
  };

  return (
    <AppLayout title="Transactions">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["pos", "history"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="btn-tap capitalize"
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            {tab === "pos" ? "POS" : "Riwayat"}
          </Button>
        ))}
      </div>

      {activeTab === "pos" ? (
        <div className="text-center py-20">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-semibold mb-2">Halaman POS</h2>
          <p className="text-muted-foreground">Fitur POS dalam pengembangan</p>
        </div>
      ) : (
        /* History Tab - Admin Transaction Management */
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Kelola Transaksi
            </h3>
            <Badge variant="outline" className="font-normal">
              {filteredTransactions.length} transaksi
            </Badge>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari transaksi..."
              value={searchTransaction}
              onChange={(e) => setSearchTransaction(e.target.value)}
              className="pl-9 bg-card/70 backdrop-blur border-border/50"
            />
          </div>

          {/* Transaction List */}
          <div className="space-y-3">
            {transactionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Memuat transaksi...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Tidak ada transaksi ditemukan</p>
              </div>
            ) : (
              filteredTransactions.map((tx: Transaction, i: number) => {
                const actionInfo = getActionForStatus(tx.status, !!tx.path_proof_pickup);
                const isActionable = actionInfo && actionInfo.action !== 'completed';

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-mono font-semibold text-sm">
                          {tx.transaction_code || tx.id?.slice(0, 8) || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(tx.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{tx.customer_name || 'N/A'}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{tx.location_name || tx.location_code || '-'}</span>
                        </div>
                      </div>
                      <p className="font-bold text-primary">
                        {formatCurrency(tx.total_amount)}
                      </p>
                    </div>

                    {/* Pickup Proof Status */}
                    {tx.path_proof_pickup && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 rounded-lg">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">
                          Bukti serah terima uploaded
                        </span>
                        {tx.pickup_at && (
                          <span className="text-xs text-green-600">
                            - {new Date(tx.pickup_at).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    {isActionable && (
                      <div className="flex gap-2">
                        {actionInfo?.action === 'upload_proof' && (
                          <Button
                            size="sm"
                            className="flex-1 btn-tap"
                            onClick={() => handleUploadPickupProof(tx)}
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Upload Bukti Serah Terima
                          </Button>
                        )}
                        {actionInfo?.action === 'mark_ready' && (
                          <Button
                            size="sm"
                            className="flex-1 btn-tap bg-green-600 hover:bg-green-700"
                            onClick={() => handleMarkReady(tx.id)}
                            disabled={markReadyMutation.isPending}
                          >
                            {markReadyMutation.isPending ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            Tandai Siap Diambil
                          </Button>
                        )}
                        {actionInfo?.action === 'prepare' && (
                          <div className="flex-1 text-center p-2 bg-muted/50 rounded-lg">
                            <span className="text-xs text-muted-foreground">
                              Menunggu preparation barang
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completed Status */}
                    {tx.status === 'COMPLETED' && (
                      <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg">
                        <Check className="h-4 w-4 text-green-700" />
                        <span className="text-xs text-green-700 font-medium">
                          Transaksi selesai - Barang sudah diterima customer
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </GlassCard>
      )}

      {/* Pickup Proof Modal - For Admin to Upload */}
      {selectedTransaction && (
        <PickupProofModal
          isOpen={pickupModalOpen}
          onClose={() => {
            setPickupModalOpen(false);
            setSelectedTransaction(null);
          }}
          transactionId={selectedTransaction.id}
          transactionCode={selectedTransaction.transaction_code || selectedTransaction.id?.slice(0, 8) || '-'}
          onSuccess={handlePickupProofSuccess}
        />
      )}
    </AppLayout>
  );
}