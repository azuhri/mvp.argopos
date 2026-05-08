import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, CheckCircle, Package, Search, Store, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardMobileNav } from "@/components/layout/DashboardMobileNav";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { Badge } from "@/components/ui/badge";
import { transactionService, type TransactionListResult } from "@/lib/services/transactionService";
import { userService } from "@/lib/services/userService";
import type { Transaction } from "@/lib/api";

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
  const [approvalTarget, setApprovalTarget] = useState<{ transaction: Transaction; action: "payment" | "delivery" } | null>(null);

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
      <DashboardMobileNav />
      <div className="space-y-4">
        <GlassCard>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Transaction Overview</h2>
                <p className="text-sm text-muted-foreground">
                  Monitor cooperative transactions with role-aware access and responsive controls.
                </p>
              </div>
            </div>
            {!isSuperAdmin && (
              <div className="flex flex-wrap gap-2 text-sm">
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
              <div className="p-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by code, customer, or payment code"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Transaction Code</Label>
                    <Input
                      placeholder="TRX-XXXXX"
                      value={transactionCode}
                      onChange={(e) => {
                        setTransactionCode(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-sm">Date</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setPage(1);
                        }}
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Sort by</Label>
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
            </GlassCard>

            <GlassCard className="hidden md:block">
              <div className="p-4">
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
                          <TableCell className="capitalize">{tx.payment_type || "-"}</TableCell>
                          <TableCell>{formatCurrency(tx.total_amount)}</TableCell>
                          <TableCell>{new Date(tx.created_at).toLocaleString("id-ID")}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {tx.status === "WAITING_TO_PAYMENT" && (
                                <Button size="sm" variant="outline" onClick={() => setApprovalTarget({ transaction: tx, action: "payment" })}>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                              )}
                              {tx.status === "PAID" && (
                                <Button size="sm" variant="outline" onClick={() => setApprovalTarget({ transaction: tx, action: "delivery" })}>
                                  <Package className="h-3 w-3 mr-1" />
                                  Mark Preparing
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
                transactions.map((tx) => (
                  <GlassCard key={tx.id}>
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
                          <span className="text-muted-foreground">Payment:</span> {tx.payment_type || "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Items:</span> {tx.total_item}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span> {new Date(tx.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {tx.status === "WAITING_TO_PAYMENT" && (
                          <Button className="flex-1" variant="outline" size="sm" onClick={() => setApprovalTarget({ transaction: tx, action: "payment" })}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve Payment
                          </Button>
                        )}
                        {tx.status === "PAID" && (
                          <Button className="flex-1" variant="outline" size="sm" onClick={() => setApprovalTarget({ transaction: tx, action: "delivery" })}>
                            <Package className="h-3 w-3 mr-1" /> Prepare
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

            <GlassCard>
              <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {transactions.length} of {total} transactions
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
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

      <AlertDialog open={!!approvalTarget} onOpenChange={(open) => !open && !approveMutation.isPending && setApprovalTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalTarget?.action === "payment" ? "Approve Payment" : "Update Delivery Status"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approvalTarget?.action === "payment"
                ? "This will mark the transaction as paid and continue fulfillment."
                : "This will move the transaction to preparing product."}
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
    </AppLayout>
  );
}
