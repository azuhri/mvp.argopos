import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, User, Pencil, Trash2, Eye, Search, ExternalLink, Upload, CreditCard, ArrowLeft, Save, X, Plus, Calendar, Package } from "lucide-react";
import { toast } from "sonner";
import { storeService } from "@/lib/services/storeService";
import { Store, StoreAssignedUser, Transaction, StorePaymentMethod, Stock } from "@/lib/api";

export default function KoperasiDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  // Summary filters
  const [summaryStartDate, setSummaryStartDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [summaryEndDate, setSummaryEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [summaryData, setSummaryData] = useState({ total_transactions: 0, total_revenue: 0, total_stock: 0 });

  // Transaction filters
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(20);
  const [transactionStatus, setTransactionStatus] = useState('all');
  const [transactionUser, setTransactionUser] = useState('all');
  const [transactionStartDate, setTransactionStartDate] = useState('');
  const [transactionEndDate, setTransactionEndDate] = useState('');
  const [transactionPaymentMethod, setTransactionPaymentMethod] = useState('all');
  const [transactionSortBy, setTransactionSortBy] = useState('created_at');
  const [transactionSortOrder, setTransactionSortOrder] = useState<'asc' | 'desc'>('desc');
  const [transactionTotal, setTransactionTotal] = useState(0);

  // Stock edit state
  const [stockEditOpen, setStockEditOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [stockFormData, setStockFormData] = useState({ base_price: 0, discount_price: 0, tax_percentage: 0 });

  // Payment method state
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    payment_type: 'qris',
    image_url: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    is_active: true,
  });
  const [deletePaymentOpen, setDeletePaymentOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<StorePaymentMethod | null>(null);

  useEffect(() => {
    if (locationId) {
      loadStoreDetail();
      loadSummaryData();
    }
  }, [locationId, summaryStartDate, summaryEndDate]);

  useEffect(() => {
    if (locationId && activeTab === 'transaction') {
      loadTransactions();
    }
  }, [locationId, activeTab, transactionPage, transactionPageSize, transactionStatus, transactionUser, transactionStartDate, transactionEndDate, transactionPaymentMethod, transactionSortBy, transactionSortOrder]);

  const loadStoreDetail = async () => {
    try {
      setLoading(true);
      const data = await storeService.getStoreDetail(locationId!);
      setStore(data);
    } catch (error) {
      toast.error("Failed to load store detail");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaryData = async () => {
    try {
      // TODO: Call API to get filtered summary data
      // For now, use the store data
      if (store) {
        setSummaryData({
          total_transactions: store.total_transactions,
          total_revenue: store.total_revenue,
          total_stock: store.total_stock,
        });
      }
    } catch (error) {
      toast.error("Failed to load summary data");
      console.error(error);
    }
  };

  const loadTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const { transactions, total } = await storeService.getStoreTransactions(locationId!, {
        status: transactionStatus === 'all' ? '' : transactionStatus,
        user_id: transactionUser === 'all' ? '' : transactionUser,
        start_date: transactionStartDate,
        end_date: transactionEndDate,
        payment_method: transactionPaymentMethod === 'all' ? '' : transactionPaymentMethod,
        sort_by: transactionSortBy,
        sort_order: transactionSortOrder,
        page: transactionPage,
        page_size: transactionPageSize,
      });
      setTransactions(transactions);
      setTransactionTotal(total);
    } catch (error) {
      toast.error("Failed to load transactions");
      console.error(error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const calculateFinalPrice = (stock: Stock) => {
    const basePrice = stock.base_price;
    const discountPrice = stock.discount_price || 0;
    const taxPercentage = stock.tax_percentage || 0;
    const price = discountPrice > 0 ? discountPrice : basePrice;
    const tax = price * (taxPercentage / 100);
    return price - tax;
  };

  const openStockEdit = (stock: Stock) => {
    setEditingStock(stock);
    setStockFormData({
      base_price: stock.base_price,
      discount_price: stock.discount_price || 0,
      tax_percentage: stock.tax_percentage || 0,
    });
    setStockEditOpen(true);
  };

  const handleStockSave = async () => {
    if (!editingStock) return;

    try {
      // Call API to update stock
      // For now, just update local state
      setStore((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          product_stores: prev.product_stores.map((s) =>
            s.id === editingStock.id
              ? { ...s, ...stockFormData }
              : s
          ),
        };
      });
      toast.success("Stock updated successfully");
      setStockEditOpen(false);
    } catch (error) {
      toast.error("Failed to update stock");
      console.error(error);
    }
  };

  const openPaymentMethod = () => {
    setPaymentFormData({
      payment_type: 'qris',
      image_url: '',
      bank_name: '',
      account_number: '',
      account_name: '',
      is_active: true,
    });
    setPaymentMethodOpen(true);
  };

  const handlePaymentSave = async () => {
    try {
      await storeService.upsertPaymentMethod({
        location_id: locationId!,
        ...paymentFormData,
      });
      toast.success("Payment method saved successfully");
      setPaymentMethodOpen(false);
      loadStoreDetail();
    } catch (error) {
      toast.error("Failed to save payment method");
      console.error(error);
    }
  };

  const openDeletePayment = (pm: StorePaymentMethod) => {
    setDeletingPayment(pm);
    setDeletePaymentOpen(true);
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;

    try {
      await storeService.deletePaymentMethod(deletingPayment.id);
      toast.success("Payment method deleted successfully");
      setDeletePaymentOpen(false);
      loadStoreDetail();
    } catch (error) {
      toast.error("Failed to delete payment method");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <Building2 className="h-10 w-10 animate-pulse opacity-40" />
        </div>
      </AppLayout>
    );
  }

  if (!store) {
    return (
      <AppLayout title="Store Not Found">
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Store not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/koperasi')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={store.location_name}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/koperasi')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="users">User Assigned</TabsTrigger>
          <TabsTrigger value="transaction">Transaction</TabsTrigger>
          <TabsTrigger value="payment">Payment Method</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Filter by Date Range</h4>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={summaryStartDate}
                      onChange={(e) => setSummaryStartDate(e.target.value)}
                      className="w-auto"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="date"
                      value={summaryEndDate}
                      onChange={(e) => setSummaryEndDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Total Transaksi</p>
                  <p className="text-2xl font-bold text-foreground">
                    <AnimatedCounter end={summaryData.total_transactions} />
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(summaryData.total_revenue)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Total Stock</p>
                  <p className="text-2xl font-bold text-foreground">{summaryData.total_stock}</p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Product Stocks */}
          <GlassCard>
            <div className="p-4">
              <h4 className="font-semibold mb-3">Product Stock</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Discount Price</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead>Final Price</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {store.product_stores.length > 0 ? (
                    store.product_stores.map((stock) => (
                      <TableRow key={stock.id}>
                        <TableCell>
                          {stock.master_product?.image_url ? (
                            <img
                              src={stock.master_product.image_url}
                              alt={stock.master_product.product_name}
                              className="w-12 h-12 object-cover rounded-md"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{stock.master_product?.product_name || '-'}</TableCell>
                        <TableCell>{stock.stock}</TableCell>
                        <TableCell>{formatCurrency(stock.base_price)}</TableCell>
                        <TableCell>{stock.discount_price ? formatCurrency(stock.discount_price) : '-'}</TableCell>
                        <TableCell>{stock.tax_percentage}%</TableCell>
                        <TableCell>{formatCurrency(calculateFinalPrice(stock))}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openStockEdit(stock)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Tidak ada product stock
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>

        {/* User Assigned Tab */}
        <TabsContent value="users">
          <GlassCard>
            <div className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                User Assigned ({store.assigned_users.length})
              </h4>
              {store.assigned_users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>No. WA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {store.assigned_users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.no_wa || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak ada user assigned</p>
              )}
            </div>
          </GlassCard>
        </TabsContent>

        {/* Transaction Tab */}
        <TabsContent value="transaction">
          <GlassCard>
            <div className="p-4">
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Label>Status:</Label>
                  <Select value={transactionStatus} onValueChange={setTransactionStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="PREPARING_PRODUCT">Preparing</SelectItem>
                      <SelectItem value="READY_TO_PICKUP">Ready</SelectItem>
                      <SelectItem value="WAITING_TO_PAYMENT">Waiting Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>User:</Label>
                  <Select value={transactionUser} onValueChange={setTransactionUser}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {store?.assigned_users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Payment Method:</Label>
                  <Select value={transactionPaymentMethod} onValueChange={setTransactionPaymentMethod}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                      <SelectItem value="transfer_rekening">Transfer</SelectItem>
                      <SelectItem value="cutoff_hutang">Cutoff/Hutang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={transactionStartDate}
                    onChange={(e) => setTransactionStartDate(e.target.value)}
                    className="w-auto"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={transactionEndDate}
                    onChange={(e) => setTransactionEndDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Sort By:</Label>
                  <Select value={transactionSortBy} onValueChange={setTransactionSortBy}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created At</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={transactionSortOrder} onValueChange={(v) => setTransactionSortOrder(v as 'asc' | 'desc')}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Desc</SelectItem>
                      <SelectItem value="asc">Asc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">{tx.id.slice(0, 8)}...</TableCell>
                        <TableCell>{tx.customer_name || '-'}</TableCell>
                        <TableCell>
                          <StatusBadge status={tx.status === 'COMPLETED' ? 'active' : 'inactive'} />
                        </TableCell>
                        <TableCell>{formatCurrency(tx.total_amount)}</TableCell>
                        <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Tidak ada transaksi
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Total: {transactionTotal} transactions
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransactionPage((prev) => Math.max(1, prev - 1))}
                    disabled={transactionPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2">Page {transactionPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransactionPage((prev) => prev + 1)}
                    disabled={transactions.length < transactionPageSize}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* Payment Method Tab */}
        <TabsContent value="payment">
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Payment Methods
                </h4>
                <Button size="sm" onClick={openPaymentMethod}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Payment Method
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {store.payment_methods.map((pm) => (
                  <div key={pm.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium capitalize">{pm.payment_type.replace('_', ' ')}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDeletePayment(pm)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {pm.image_url && (
                      <img src={pm.image_url} alt={pm.payment_type} className="w-full h-32 object-cover rounded mb-2" />
                    )}
                    {pm.bank_name && (
                      <p className="text-sm text-muted-foreground">
                        {pm.bank_name} - {pm.account_number} ({pm.account_name})
                      </p>
                    )}
                  </div>
                ))}
                {store.payment_methods.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-3">
                    Tidak ada payment method
                  </p>
                )}
              </div>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>

      {/* Stock Edit Dialog */}
      <Dialog open={stockEditOpen} onOpenChange={setStockEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product Stock</DialogTitle>
            <DialogDescription>Update harga dan pajak untuk produk ini</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Base Price</Label>
              <Input
                type="number"
                value={stockFormData.base_price}
                onChange={(e) => setStockFormData({ ...stockFormData, base_price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Discount Price</Label>
              <Input
                type="number"
                value={stockFormData.discount_price}
                onChange={(e) => setStockFormData({ ...stockFormData, discount_price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tax Percentage (%)</Label>
              <Input
                type="number"
                value={stockFormData.tax_percentage}
                onChange={(e) => setStockFormData({ ...stockFormData, tax_percentage: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockEditOpen(false)}>Batal</Button>
            <Button onClick={handleStockSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={paymentMethodOpen} onOpenChange={setPaymentMethodOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Payment Method</DialogTitle>
            <DialogDescription>Tambah metode pembayaran untuk store ini</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipe Pembayaran</Label>
              <Select value={paymentFormData.payment_type} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, payment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="transfer_rekening">Transfer Rekening</SelectItem>
                  <SelectItem value="cutoff_hutang">Cutoff/Hutang</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input
                value={paymentFormData.image_url}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            {paymentFormData.payment_type === 'transfer_rekening' && (
              <>
                <div className="space-y-1.5">
                  <Label>Nama Bank</Label>
                  <Input
                    value={paymentFormData.bank_name}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Rekening</Label>
                  <Input
                    value={paymentFormData.account_number}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nama Pemilik</Label>
                  <Input
                    value={paymentFormData.account_name}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, account_name: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentMethodOpen(false)}>Batal</Button>
            <Button onClick={handlePaymentSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Method Confirmation */}
      <AlertDialog open={deletePaymentOpen} onOpenChange={setDeletePaymentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Payment Method?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus metode pembayaran ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
