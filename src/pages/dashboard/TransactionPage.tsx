import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, CheckCircle, Eye, Package, Search, Store, ArrowUpDown, Camera, Upload, X, FileDown, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardMobileNav } from "@/components/layout/DashboardMobileNav";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DokuFulfillmentActions } from "@/components/shared/DokuFulfillmentActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { transactionService, type TransactionListResult } from "@/lib/services/transactionService";
import { userService } from "@/lib/services/userService";
import { config } from "@/lib/config";
import { apiClient } from "@/lib/api";
import type { Transaction, TransactionCart } from "@/lib/api";
import {
  exportTransactionsToCSV,
  exportTransactionsToXLSX,
  exportTransactionInvoiceToPDF,
  exportAllTransactionsInvoiceToPDF,
} from "@/lib/exportUtils";

const PAYMENT_OPTIONS = [
  { label: "All Methods", value: "all" },
  { label: "QRIS", value: "qris" },
  { label: "Transfer", value: "transfer_rekening" },
  { label: "Cutoff/Hutang", value: "cutoff_hutang" },
];

const STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Waiting Payment", value: "WAITING_TO_PAYMENT" },
  { label: "Paid", value: "PAID" },
  { label: "Preparing", value: "PREPARING_PRODUCT" },
  { label: "Ready", value: "READY_TO_PICKUP" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Rejected", value: "REJECTED" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value || 0);

const getStatusBadgeKey = (status: string) => {
  const map: Record<string, Parameters<typeof StatusBadge>[0]["status"]> = {
    WAITING_TO_PAYMENT: "waiting_payment",
    PAID: "paid",
    PREPARING_PRODUCT: "preparing_product",
    READY_TO_PICKUP: "ready_to_pickup",
    COMPLETED: "completed",
    REJECTED: "inactive",
  };
  return map[status] || "inactive";
};

const paymentMethodLabel = (paymentType: string) => {
  let value;
  switch (paymentType) {
    case 'qris':
      value = 'QRIS';
      break;
    case 'cash':
      value = 'Tunai';
      break;
    case 'transfer_rekening':
      value = 'Transfer Bank';
      break;
    default:
      value = paymentType;
  }
  return <Badge variant="secondary">{value}</Badge>;
};




export default function TransactionPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [transactionCode, setTransactionCode] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [approvalTarget, setApprovalTarget] = useState<{ transaction: Transaction; action: "payment" } | null>(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartModalLoading, setCartModalLoading] = useState(false);
  const [cartModalTransaction, setCartModalTransaction] = useState<Transaction | null>(null);
  const [cartModalItems, setCartModalItems] = useState<TransactionCart[]>([]);
  // Pickup proof upload modal state
  const [pickupProofModalOpen, setPickupProofModalOpen] = useState(false);
  const [pickupProofTransaction, setPickupProofTransaction] = useState<Transaction | null>(null);
  const [pickupProofFile, setPickupProofFile] = useState<File | null>(null);
  const [pickupProofPreview, setPickupProofPreview] = useState<string | null>(null);
  const [pickupProofUploading, setPickupProofUploading] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => userService.getCurrentUser(),
  });

  const assignedStores = currentUser?.assigned_stores ?? [];
  const isSuperAdmin = currentUser?.role?.role_name === "super_admin";

  const storeOptions = useMemo(
    () =>
      assignedStores.map((store) => ({
        id: store.id,
        name: store.location_name,
      })),
    [assignedStores]
  );

  const assignedStoreIds = useMemo(() => storeOptions.map((store) => store.id), [storeOptions]);

  const closeCartModal = () => {
    setCartModalOpen(false);
    setCartModalTransaction(null);
    setCartModalItems([]);
  };

  // Pickup proof handlers
  const openPickupProofModal = (tx: Transaction) => {
    setPickupProofTransaction(tx);
    setPickupProofFile(null);
    setPickupProofPreview(null);
    setPickupProofModalOpen(true);
  };

  const closePickupProofModal = () => {
    setPickupProofModalOpen(false);
    setPickupProofTransaction(null);
    setPickupProofFile(null);
    setPickupProofPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    setPickupProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPickupProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadProof = async () => {
    if (!pickupProofTransaction || !pickupProofFile) return;
    setPickupProofUploading(true);
    try {
      // Use apiClient.uploadPickupProof with file upload (follows Products.tsx pattern)
      const response = pickupProofTransaction.payment_provider === "DOKU"
        ? await apiClient.uploadStaffPickupProof(pickupProofTransaction.id, pickupProofFile)
        : await apiClient.uploadPickupProof(pickupProofTransaction.id, pickupProofFile);
      if (!response.success) throw new Error(response.message || 'Upload failed');
      toast.success('Bukti serah terima berhasil diupload');
      closePickupProofModal();
      transactionsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setPickupProofUploading(false);
    }
  };

  const handleMarkReadyPickup = async (tx: Transaction) => {
    try {
      const res = await fetch(`${config.apiUrl}/transactions/${tx.id}/mark-ready-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
      toast.success('Berhasil menandai siap diambil');
      transactionsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Gagal');
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    try {
      exportTransactionsToCSV(transactions);
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const handleExportXLSX = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    try {
      exportTransactionsToXLSX(transactions);
      toast.success('Excel exported successfully');
    } catch (error) {
      toast.error('Failed to export Excel');
    }
  };

  const handleExportPDF = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    try {
      exportAllTransactionsInvoiceToPDF(transactions);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleViewCartItems = async (transactionId: string) => {
    setCartModalOpen(true);
    setCartModalLoading(true);
    setCartModalItems([]);
    try {
      const detail = await transactionService.getTransactionDetail(transactionId);
      setCartModalTransaction(detail);
      setCartModalItems(detail.transaction_carts || []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load transaction items");
    } finally {
      setCartModalLoading(false);
    }
  };

  const locationScope = useMemo(() => {
    if (isSuperAdmin) {
      return storeFilter === "all" ? undefined : [storeFilter];
    }
    if (storeFilter === "all") {
      return assignedStoreIds;
    }
    return [storeFilter];
  }, [isSuperAdmin, storeFilter, assignedStoreIds]);

  const canFetchTransactions = !!currentUser && (isSuperAdmin || (locationScope?.length ?? 0) > 0);

  const transactionsQuery = useQuery<TransactionListResult>({
    queryKey: [
      "transactions",
      {
        search,
        statusFilter,
        storeFilter,
        paymentFilter,
        transactionCode,
        sortBy,
        sortOrder,
        startDate,
        endDate,
        page,
        pageSize,
      },
    ],
    enabled: canFetchTransactions,
    queryFn: async () => {
      const response = await transactionService.listTransactions({
        page,
        page_size: pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
        payment_method: paymentFilter === "all" ? undefined : paymentFilter,
        transaction_code: transactionCode || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortBy,
        sort_order: sortOrder.toUpperCase(),
        search: search || undefined,
        ...(locationScope && locationScope.length > 0 ? { location_ids: locationScope } : {}),
      });
      return response;
    },
  });

  const transactions = transactionsQuery.data?.transactions ?? [];
  const meta = transactionsQuery.data?.meta;
  const total = meta?.total ?? transactions.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approvalTarget) return;
      if (approvalTarget.action === "payment") {
        await transactionService.approvePayment(approvalTarget.transaction.id);
      } else {
        await transactionService.approveDelivery(approvalTarget.transaction.id);
      }
    },
    onSuccess: () => {
      toast.success("Transaction updated successfully");
      setApprovalTarget(null);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update transaction");
    },
  });

  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const disableContent = !isSuperAdmin && assignedStoreIds.length === 0;

  return (
    <AppLayout title="Transactions">
      {/* <DashboardMobileNav /> */}
      <div className="space-y-4">
        <GlassCard className="p-4">
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="hidden md:block">
                <Store className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Transaction Overview</h2>
                {/* <p className="text-md text-muted-foreground">
                  Monitor cooperative transactions with role-aware access and responsive controls.
                </p> */}
                {!isSuperAdmin && (
                  <div className="flex flex-wrap gap-2 text-sm mt-1">
                    <span className="text-muted-foreground">Assigned Stores:</span>
                    {storeOptions.length > 0 ? (
                      storeOptions.map((store) => (
                        <Badge key={store.id} variant="outline">
                          {store.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary">No store assignment</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {disableContent ? (
          <GlassCard>
            <div className="p-8 text-center text-muted-foreground">
              You don't have any assigned stores yet. Please contact an administrator.
            </div>
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Store</Label>
                    <Select value={storeFilter} onValueChange={handleFilterChange(setStoreFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All stores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isSuperAdmin ? "All Stores" : "All Assigned"}</SelectItem>
                        {storeOptions.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Status</Label>
                    <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Payment</Label>
                    <Select value={paymentFilter} onValueChange={handleFilterChange(setPaymentFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Transaction Code</Label>
                    <Input
                      className="placeholder:text-xs"
                      placeholder="TRX-XXXXX"
                      value={transactionCode}
                      onChange={(e) => {
                        setTransactionCode(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                    <div className="w-full flex flex-col items-start gap-2">
                      <Label className="text-sm">Start Date</Label>
                      <Input
                        type="date"
                        className="w-full flex justify-between"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setPage(1);
                        }}
                      />

                    </div>
                    <div className="w-full flex flex-col items-start gap-2">
                      <Label className="text-sm">End Date</Label>
                      <Input
                        type="date"
                        className="w-full flex justify-between"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Sort by</Label>
                    <div className="flex gap-2">
                      <Select value={sortBy} onValueChange={handleFilterChange(setSortBy)}>
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
                        onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="hidden md:block">
              <div className="p-4 space-y-4">
                <div className="flex gap-4 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
                    <Input
                      className="pl-9 bg-card border border-border"
                      placeholder="Search by code, customer, or payment code"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        Invoice (PDF)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel (.csv)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel (.xlsx)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Loading transactions...
                        </TableCell>
                      </TableRow>
                    ) : transactions.length > 0 ? (
                      transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">{tx.transaction_code || tx.id.slice(0, 8)}</TableCell>
                          <TableCell>{tx.location_name || "-"}</TableCell>
                          <TableCell>{tx.customer_name || "Guest"}</TableCell>
                          <TableCell>
                            <StatusBadge status={getStatusBadgeKey(tx.status)} />
                          </TableCell>
                          <TableCell className="capitalize">{paymentMethodLabel(tx.payment_type) || "-"}</TableCell>
                          <TableCell>{formatCurrency(tx.total_amount)}</TableCell>
                          <TableCell>{new Date(tx.created_at).toLocaleString("id-ID")}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleViewCartItems(tx.id)}>
                                <Eye className="h-3 w-3 mr-1" /> Items
                              </Button>
                              {tx.status === "WAITING_TO_PAYMENT" && tx.payment_provider !== "DOKU" && (
                                <Button size="sm" variant="outline" onClick={() => setApprovalTarget({ transaction: tx, action: "payment" })}>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve Payment
                                </Button>
                              )}
                              <DokuFulfillmentActions transaction={tx} onUpdated={() => void transactionsQuery.refetch()} onUpload={() => openPickupProofModal(tx)} />
                              {tx.payment_provider !== "DOKU" && (tx.status === "PAID" || tx.status === "PREPARING_PRODUCT") && !tx.path_proof_pickup && (
                                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={() => openPickupProofModal(tx)}>
                                  <Camera className="h-3 w-3 mr-1" />
                                  Upload Bukti
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>

            <div className="md:hidden space-y-4">
              {transactionsQuery.isLoading ? (
                <div className="text-center text-muted-foreground py-8">Loading transactions...</div>
              ) : transactions.length > 0 ? (
                <>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <FileDown className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportPDF}>
                          <FileText className="h-4 w-4 mr-2" />
                          Invoice (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleExportCSV}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel (.csv)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportXLSX}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Excel (.xlsx)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {transactions.map((tx) => (
                  <GlassCard className="p-2" key={tx.id}>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground font-mono">{tx.transaction_code || tx.id.slice(0, 8)}</p>
                          <h4 className="font-semibold text-sm">{tx.customer_name || "Guest"}</h4>
                          <p className="text-xs text-muted-foreground">{tx.location_name || "-"}</p>
                        </div>
                        <StatusBadge status={getStatusBadgeKey(tx.status)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Total:</span> {formatCurrency(tx.total_amount)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Payment:</span> {paymentMethodLabel(tx.payment_type)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Items:</span> {tx.transaction_carts?.length || 0}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span> {new Date(tx.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewCartItems(tx.id)}>
                          <Eye className="h-3 w-3 mr-1" /> View Items
                        </Button>
                        <div className="flex gap-2">
                          {tx.status === "WAITING_TO_PAYMENT" && tx.payment_provider !== "DOKU" && (
                            <Button className="flex-1" variant="outline" size="sm" onClick={() => setApprovalTarget({ transaction: tx, action: "payment" })}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve Payment
                            </Button>
                          )}
                          <DokuFulfillmentActions transaction={tx} onUpdated={() => void transactionsQuery.refetch()} onUpload={() => openPickupProofModal(tx)} className="flex-1" />
                          {tx.payment_provider !== "DOKU" && (tx.status === "PAID" || tx.status === "PREPARING_PRODUCT") && !tx.path_proof_pickup && (
                            <Button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white" size="sm" onClick={() => openPickupProofModal(tx)}>
                              <Camera className="h-3 w-3 mr-1" /> Upload Bukti
                            </Button>
                          )}
                          {tx.payment_provider !== "DOKU" && tx.path_proof_pickup && (
                            <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white" size="sm" onClick={() => handleMarkReadyPickup(tx)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Siap Diambil
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </GlassCard>
                ))}
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">No transactions found</div>
              )}
            </div>

            <GlassCard>
              <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {transactions.length} of {total} transactions
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex flex-row items-center gap-2">
                    <span className="text-sm">Rows:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 20, 50].map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </>
        )}
      </div>

      <Dialog open={cartModalOpen} onOpenChange={(open) => {
        if (!open) closeCartModal();
        else setCartModalOpen(true);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Items</DialogTitle>
            <DialogDescription>
              {cartModalTransaction ? `Transaction ${cartModalTransaction.transaction_code || cartModalTransaction.id}` : 'Detail produk dalam transaksi'}
            </DialogDescription>
          </DialogHeader>
          {cartModalLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading items...</div>
          ) : cartModalItems.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {cartModalItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 rounded-lg border p-3">
                  {item.product_details?.image_path ? (
                    <img
                      src={`${config.apiUrl}/${item.product_details.image_path}`}
                      alt={item.product_details?.product_name || 'Product'}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.product_details?.product_name || 'Product'}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(item.amount || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Qty</p>
                    <p className="font-semibold">x{item.qty}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No items available</div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!approvalTarget} onOpenChange={(open) => !open && !approveMutation.isPending && setApprovalTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalTarget?.action === "payment" ? "Approve Payment" : "Update Delivery Status"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approvalTarget?.action === "payment"
                ? "This will mark the transaction as paid."
                : "This will move to preparing product."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              {approveMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pickup Proof Upload Modal */}
      <Dialog open={pickupProofModalOpen} onOpenChange={(open) => { if (!open) closePickupProofModal(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Bukti Serah Terima</DialogTitle>
            <DialogDescription>
              Transaksi: {pickupProofTransaction?.transaction_code || pickupProofTransaction?.id?.slice(0, 8) || '-'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!pickupProofPreview ? (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary transition-colors">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <Camera className="h-12 w-12 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ambil foto atau upload bukti</span>
                <span className="text-xs text-muted-foreground">JPG/PNG, max 5MB</span>
              </label>
            ) : (
              <div className="relative">
                <img src={pickupProofPreview} alt="Preview" className="w-full h-auto max-h-48 rounded-lg object-contain" />
                <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => { setPickupProofFile(null); setPickupProofPreview(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button className="w-full" disabled={!pickupProofFile || pickupProofUploading} onClick={handleUploadProof}>
              {pickupProofUploading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Mengupload... </>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Upload Bukti </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
