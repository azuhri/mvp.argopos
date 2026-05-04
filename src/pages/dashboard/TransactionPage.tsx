import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardMobileNav } from "@/components/layout/DashboardMobileNav";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/mockData";
import { useState, useEffect } from "react";
import { Search, Calendar, CheckCircle, Package, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type TransactionStatus = "WAITING_TO_PAYMENT" | "PAID" | "PREPARING_PRODUCT" | "READY_TO_PICKUP" | "COMPLETED";

interface Transaction {
  id: string;
  customer_name?: string;
  status: TransactionStatus;
  total_amount: number;
  payment_code: string;
  base_amount: number;
  total_item: number;
  created_at: string;
  paid_at?: string;
}

interface TransactionCart {
  id: string;
  product_name: string;
  qty: number;
  amount: number;
}

export default function TransactionPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    // TODO: Fetch from API
    // const data = await transactionService.getTransactions({ status: statusFilter, ... });
    setLoading(false);
  };

  const handleApprovePayment = async (transactionId: string) => {
    try {
      // TODO: Call API
      // await transactionService.approvePayment(transactionId);
      toast.success("Payment approved successfully");
      loadTransactions();
    } catch (error) {
      toast.error("Failed to approve payment");
    }
  };

  const handleApproveDelivery = async (transactionId: string) => {
    try {
      // TODO: Call API
      // await transactionService.approveDelivery(transactionId);
      toast.success("Delivery approved successfully");
      loadTransactions();
    } catch (error) {
      toast.error("Failed to approve delivery");
    }
  };

  const getStatusBadge = (status: TransactionStatus) => {
    const statusMap: Record<TransactionStatus, "active" | "inactive" | "pending"> = {
      "WAITING_TO_PAYMENT": "pending",
      "PAID": "active",
      "PREPARING_PRODUCT": "active",
      "READY_TO_PICKUP": "active",
      "COMPLETED": "active",
    };
    return <StatusBadge status={statusMap[status]} />;
  };

  const filteredTransactions = transactions
    .filter(t => 
      (statusFilter === "all" || t.status === statusFilter) &&
      (t.id.toLowerCase().includes(search.toLowerCase()) || 
       t.customer_name?.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortBy === "total_amount") {
        comparison = a.total_amount - b.total_amount;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <AppLayout title="Transactions">
      <DashboardMobileNav />
      <div>
        {/* Filters */}
        <GlassCard className="mb-4">
          <div className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>Status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="WAITING_TO_PAYMENT">Waiting Payment</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="PREPARING_PRODUCT">Preparing</SelectItem>
                    <SelectItem value="READY_TO_PICKUP">Ready</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Date:</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-auto"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label>Sort By:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Created At</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="total_amount">Total Amount</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Desktop/Tablet: Table View */}
        <GlassCard className="hidden md:block">
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Payment Code</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{tx.id.slice(0, 8)}...</TableCell>
                      <TableCell>{tx.customer_name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell>{formatCurrency(tx.total_amount)}</TableCell>
                      <TableCell>{tx.payment_code}</TableCell>
                      <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {tx.status === "WAITING_TO_PAYMENT" && (
                            <Button
                              size="sm"
                              onClick={() => handleApprovePayment(tx.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve Payment
                            </Button>
                          )}
                          {tx.status === "PAID" && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveDelivery(tx.id)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Package className="h-3 w-3 mr-1" />
                              Approve Delivery
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        {/* Mobile: Card View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <GlassCard key={tx.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">ID: {tx.id.slice(0, 8)}...</p>
                      <h4 className="font-semibold text-sm">{tx.customer_name || 'Guest'}</h4>
                    </div>
                    {getStatusBadge(tx.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-medium">{formatCurrency(tx.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment Code:</span>{" "}
                      <span className="font-medium">{tx.payment_code}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>{" "}
                      <span className="font-medium">{new Date(tx.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items:</span>{" "}
                      <span className="font-medium">{tx.total_item}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {tx.status === "WAITING_TO_PAYMENT" && (
                      <Button
                        size="sm"
                        onClick={() => handleApprovePayment(tx.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve Payment
                      </Button>
                    )}
                    {tx.status === "PAID" && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveDelivery(tx.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <Package className="h-3 w-3 mr-1" />
                        Approve Delivery
                      </Button>
                    )}
                  </div>
                </motion.div>
              </GlassCard>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">No transactions found</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
