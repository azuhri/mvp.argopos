import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, CheckCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

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
  transaction_code?: string;
  customer_name?: string;
  customer_no_wa?: string;
  status: string;
  payment_type?: string;
  total_amount: number;
  base_amount: number;
  created_at: string;
  transaction_carts?: TransactionCart[];
}

export default function PaymentApprovalPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingTransaction, setApprovingTransaction] = useState<Transaction | null>(null);
  const [approvingLoading, setApprovingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");

  useEffect(() => {
    if (locationId) {
      loadPendingTransactions();
    }
  }, [locationId]);

  const loadPendingTransactions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStoreTransactions(locationId!, {
        status: 'WAITING_TO_PAYMENT',
        page: 1,
        page_size: 100,
      });

      if (response.success && response.data) {
        setTransactions((response.data as unknown as Transaction[]).filter((transaction) => transaction.payment_provider !== "DOKU"));
      }
    } catch (error) {
      toast.error("Failed to load pending transactions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (transaction: Transaction) => {
    setApprovingTransaction(transaction);
    setApproveDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!approvingTransaction || approvingTransaction.payment_provider === "DOKU") return;

    try {
      setApprovingLoading(true);
      const response = await apiClient.approveTransactionPayment(approvingTransaction.id);

      if (response.success) {
        toast.success("Payment approved successfully");
        setApproveDialogOpen(false);
        setApprovingTransaction(null);
        loadPendingTransactions();
      } else {
        throw new Error("Failed to approve payment");
      }
    } catch (error) {
      toast.error("Failed to approve payment");
      console.error(error);
    } finally {
      setApprovingLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getPaymentMethodLabel = (type?: string) => {
    if (!type) return <Badge variant="secondary">Unknown</Badge>;
    switch (type) {
      case 'qris':
        return <Badge variant="secondary">QRIS</Badge>;
      case 'transfer_rekening':
        return <Badge variant="secondary">Transfer</Badge>;
      case 'cutoff_hutang':
        return <Badge variant="secondary">Cutoff</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (tx.transaction_code || '').toLowerCase().includes(query) ||
      (tx.customer_name || '').toLowerCase().includes(query)
    );
  }).filter((tx) => {
    if (paymentMethodFilter === 'all') return true;
    return tx.payment_type === paymentMethodFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/master/store/${locationId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <h1 className="text-2xl font-bold">Approval Pembayaran</h1>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Metode Bayar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
                <SelectItem value="transfer_rekening">Transfer</SelectItem>
                <SelectItem value="cutoff_hutang">Cutoff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Transaction List - Desktop */}
      <GlassCard className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaksi</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Metode Bayar</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <p className="font-mono text-xs font-medium">{tx.transaction_code || tx.id}</p>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{tx.customer_name || 'Guest'}</p>
                      {tx.customer_no_wa && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {tx.customer_no_wa}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getPaymentMethodLabel(tx.payment_type)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(tx.total_amount)}</TableCell>
                  <TableCell>{new Date(tx.created_at).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleApproveClick(tx)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Tidak ada transaksi yang menunggu approval
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-mono text-xs text-primary">{tx.transaction_code || tx.id}</p>
                  <h4 className="font-semibold">{tx.customer_name || 'Guest'}</h4>
                </div>
                {getPaymentMethodLabel(tx.payment_type)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-medium">{formatCurrency(tx.total_amount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tanggal:</span>{" "}
                  <span className="font-medium">{new Date(tx.created_at).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => handleApproveClick(tx)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Pembayaran
              </Button>
            </motion.div>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Tidak ada transaksi yang menunggu approval
          </div>
        )}
      </div>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Pembayaran?</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengapprove pembayaran untuk transaksi{" "}
              <span className="font-semibold">{approvingTransaction?.transaction_code}</span>?
            </DialogDescription>
          </DialogHeader>
          {approvingTransaction && (
            <div className="py-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span>{approvingTransaction.customer_name || 'Guest'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">{formatCurrency(approvingTransaction.total_amount)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={approvingLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {approvingLoading ? 'Memproses...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
