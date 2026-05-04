import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, User, Pencil, Trash2, Eye, Search, ExternalLink, Upload, CreditCard, ArrowLeft, Save, X, Plus, Calendar, Package } from "lucide-react";
import { toast } from "sonner";
import { storeService } from "@/lib/services/storeService";
import { stockService } from "@/lib/services/stockService";
import { Store, StoreAssignedUser, Transaction, StorePaymentMethod, Stock } from "@/lib/api";
import { config } from "@/lib/config";

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
  const [transactionCode, setTransactionCode] = useState('');
  const [transactionSortBy, setTransactionSortBy] = useState('created_at');
  const [transactionSortOrder, setTransactionSortOrder] = useState<'asc' | 'desc'>('desc');
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [approvePaymentOpen, setApprovePaymentOpen] = useState(false);
  const [approvingTransactionId, setApprovingTransactionId] = useState<string | null>(null);

  // Stock edit state
  const [stockEditOpen, setStockEditOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [stockFormData, setStockFormData] = useState({ base_price: 0, discount_price: 0, tax_percentage: 0, stock: 0 });

  // Payment method state
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'create' | 'edit'>('create');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    payment_type: 'qris',
    image_url: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    is_active: true,
  });
  const [qrisImageFile, setQrisImageFile] = useState<File | null>(null);
  const [qrisImagePreview, setQrisImagePreview] = useState<string | null>(null);
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
  }, [locationId, activeTab, transactionPage, transactionPageSize, transactionStatus, transactionUser, transactionStartDate, transactionEndDate, transactionPaymentMethod, transactionCode, transactionSortBy, transactionSortOrder]);

  const loadStoreDetail = async () => {
    try {
      setLoading(true);
      let data = await storeService.getStoreDetail(locationId!);

      data.payment_methods = (data.payment_methods || []).map((payment) => ({
        ...payment,
        image_url: payment.image_url ? config.apiUrl + "/public/" + payment.image_url : '',
      }));
      console.log(data.payment_methods);
      
      setStore(data);
    } catch (error) {
      toast.error("Failed to load store detail");
      console.error(error);
    } finally {
      setLoading(false);
    }
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
        value = 'Transfer Rekening';
        break;
      default:
        value = paymentType;
    }
    return <Badge variant="secondary">{value}</Badge>;
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
        transaction_code: transactionCode,
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

  const getTransactionStatusBadge = (status: string) => {
    const statusMap: Record<string, any> = {
      'WAITING_TO_PAYMENT': 'waiting_payment',
      'PAID': 'paid',
      'PREPARING_PRODUCT': 'preparing_product',
      'READY_TO_PICKUP': 'ready_to_pickup',
      'COMPLETED': 'completed',
    };
    return statusMap[status] || 'inactive';
  };

  const calculateFinalPrice = (stock: Stock) => {
    const basePrice = stock.base_price;
    const discountPrice = stock.discount_price || 0;
    const taxPercentage = stock.tax_percentage || 0;
    const price = discountPrice > 0 ? discountPrice : basePrice;
    const tax = price * (taxPercentage / 100);
    return price + tax;
  };

  const openStockEdit = (stock: Stock) => {
    setEditingStock(stock);
    setStockFormData({
      base_price: stock.base_price,
      discount_price: stock.discount_price || 0,
      tax_percentage: stock.tax_percentage || 0,
      stock: stock.stock,
    });
    setStockEditOpen(true);
  };

  const handleStockSave = async () => {
    if (!editingStock) return;

    try {
      // Call API to update stock
      await stockService.updateStock(editingStock.id, {
        base_price: stockFormData.base_price,
        discount_price: stockFormData.discount_price,
        tax_percentage: stockFormData.tax_percentage,
        stock: stockFormData.stock,
      });

      // Update local state
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

  // Check if QRIS or Cutoff already exists
  const existingQris = store?.payment_methods.find(pm => pm.payment_type === 'qris');
  const existingTransfer = store?.payment_methods.find(pm => pm.payment_type === 'transfer_rekening');
  const existingCutoff = store?.payment_methods.find(pm => pm.payment_type === 'cutoff_hutang');

  const openPaymentMethod = (type?: 'qris' | 'transfer_rekening' | 'cutoff_hutang', existingPm?: StorePaymentMethod) => {
    // Reset file upload states
    setQrisImageFile(null);
    setQrisImagePreview(null);

    if (existingPm) {
      // Edit mode
      setPaymentMode('edit');
      setEditingPaymentId(existingPm.id);
      setPaymentFormData({
        payment_type: existingPm.payment_type,
        image_url: existingPm.image_url || '',
        bank_name: existingPm.bank_name || '',
        account_number: existingPm.account_number || '',
        account_name: existingPm.account_name || '',
        is_active: existingPm.is_active,
      });
      // Set preview if editing QRIS with existing image
      if (existingPm.payment_type === 'qris' && existingPm.image_url) {
        setQrisImagePreview(existingPm.image_url);
      }
    } else {
      // Create mode
      setPaymentMode('create');
      setEditingPaymentId(null);
      setPaymentFormData({
        payment_type: type || 'qris',
        image_url: '',
        bank_name: '',
        account_number: '',
        account_name: '',
        is_active: true,
      });
    }
    setPaymentMethodOpen(true);
  };

  const handleQrisImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrisImageFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setQrisImagePreview(previewUrl);
    }
  };

  const handleOpenQris = () => {
    if (existingQris) {
      openPaymentMethod('qris', existingQris);
    } else {
      openPaymentMethod('qris');
    }
  };

  const handleOpenCutoff = () => {
    if (existingCutoff) {
      openPaymentMethod('cutoff_hutang', existingCutoff);
    } else {
      openPaymentMethod('cutoff_hutang');
    }
  };

  const handleOpenTransfer = () => {
    openPaymentMethod('transfer_rekening');
  };

  const handleEditPayment = (pm: StorePaymentMethod) => {
    openPaymentMethod(pm.payment_type as any, pm);
  };

  const handlePaymentSave = async () => {
    try {
      // Validate required fields based on payment type
      if (paymentFormData.payment_type === 'qris') {
        if ((!qrisImageFile && !paymentFormData.image_url) || !paymentFormData.account_name) {
          toast.error("QRIS memerlukan gambar dan nama pemilik");
          return;
        }
      } else if (paymentFormData.payment_type === 'transfer_rekening') {
        if (!paymentFormData.bank_name || !paymentFormData.account_number || !paymentFormData.account_name) {
          toast.error("Transfer rekening memerlukan bank, nomor rekening, dan nama pemilik");
          return;
        }
      }

      // For QRIS with file, use FormData
      if (paymentFormData.payment_type === 'qris' && qrisImageFile) {
        const formData = new FormData();
        formData.append('location_id', locationId!);
        formData.append('payment_type', paymentFormData.payment_type);
        formData.append('account_name', paymentFormData.account_name);
        formData.append('is_active', paymentFormData.is_active.toString());
        formData.append('image_file', qrisImageFile);

        if (paymentMode === 'edit' && editingPaymentId) {
          formData.append('id', editingPaymentId);
        }

        const token = localStorage.getItem('argopos.auth.token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${config.apiUrl}/api/v1/stores/payment-methods`, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to save payment method');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Failed to save payment method');
        }
      } else {
        // For Transfer, Cutoff, or QRIS without new file, use JSON
        const payload: any = {
          location_id: locationId!,
          payment_type: paymentFormData.payment_type,
          bank_name: paymentFormData.bank_name,
          account_number: paymentFormData.account_number,
          account_name: paymentFormData.account_name,
          is_active: paymentFormData.is_active,
        };

        // Only include image_url if it has value
        if (paymentFormData.image_url) {
          payload.image_url = paymentFormData.image_url;
        }

        // Only include id when editing
        if (paymentMode === 'edit' && editingPaymentId) {
          payload.id = editingPaymentId;
        }

        await storeService.upsertPaymentMethod(payload);
      }

      toast.success(paymentMode === 'edit' ? "Payment method updated successfully" : "Payment method created successfully");
      setPaymentMethodOpen(false);

      // Reset file states
      setQrisImageFile(null);
      if (qrisImagePreview && !qrisImagePreview.startsWith('http')) {
        URL.revokeObjectURL(qrisImagePreview);
      }
      setQrisImagePreview(null);

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

  const handleApprovePayment = async (transactionId: string) => {
    setApprovingTransactionId(transactionId);
    setApprovePaymentOpen(true);
  };

  const handleConfirmApprovePayment = async () => {
    if (!approvingTransactionId) return;

    try {
      const token = localStorage.getItem('argopos.auth.token');
      const response = await fetch(`${config.apiUrl}/api/v1/transactions/required/${approvingTransactionId}/approve-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to approve payment');
      }

      toast.success("Payment approved successfully");
      setApprovePaymentOpen(false);
      setApprovingTransactionId(null);
      loadTransactions();
    } catch (error) {
      toast.error("Failed to approve payment");
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
              {/* Desktop/Tablet: Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Store Price</TableHead>
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
                          <TableCell>{formatCurrency(stock.master_product?.base_price || 0)}</TableCell>
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
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Tidak ada product stock
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile: Card View */}
              <div className="md:hidden space-y-3">
                {store.product_stores.length > 0 ? (
                  store.product_stores.map((stock) => (
                    <motion.div
                      key={stock.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-3"
                    >
                      <div className="flex items-start gap-3">
                        {stock.master_product?.image_url ? (
                          <img
                            src={stock.master_product.image_url}
                            alt={stock.master_product.product_name}
                            className="w-16 h-16 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{stock.master_product?.product_name || '-'}</h4>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Stock:</span>{" "}
                              <span className="font-medium">{stock.stock}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Final Price:</span>{" "}
                              <span className="font-medium">{formatCurrency(calculateFinalPrice(stock))}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Base Price:</span>{" "}
                              <span className="font-medium">{formatCurrency(stock.master_product?.base_price || 0)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Store Price:</span>{" "}
                              <span className="font-medium">{formatCurrency(stock.base_price)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Discount:</span>{" "}
                              <span className="font-medium">{stock.discount_price ? formatCurrency(stock.discount_price) : '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tax:</span>{" "}
                              <span className="font-medium">{stock.tax_percentage}%</span>
                            </div>
                          </div>
                          <div className="mt-2">
                            <Button variant="ghost" size="sm" onClick={() => openStockEdit(stock)}>
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">Tidak ada product stock</div>
                )}
              </div>
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
                  <Label>Transaction Code:</Label>
                  <Input
                    placeholder="Search by code"
                    value={transactionCode}
                    onChange={(e) => setTransactionCode(e.target.value)}
                    className="w-40"
                  />
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
              {/* Desktop/Tablet: Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction Code</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : transactions.length > 0 ? (
                      transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">{tx.transaction_code || '-'}</TableCell>
                          <TableCell>{tx.customer_name || '-'}</TableCell>
                          <TableCell>
                            <StatusBadge status={getTransactionStatusBadge(tx.status)} />
                          </TableCell>
                          <TableCell>{paymentMethodLabel(tx.payment_type)}</TableCell>
                          <TableCell>{formatCurrency(tx.total_amount)}</TableCell>
                          <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {tx.status === 'WAITING_TO_PAYMENT' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprovePayment(tx.id)}
                              >
                                <CreditCard className="h-3 w-3 mr-1" />
                                Confirm
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Tidak ada transaction
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile: Card View */}
              <div className="md:hidden space-y-3">
                {transactionsLoading ? (
                  <div className="text-center text-muted-foreground py-4">Loading...</div>
                ) : transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono text-xs text-primary">{tx.transaction_code || '-'}</p>
                          <h4 className="font-semibold text-sm">{tx.customer_name || 'Guest'}</h4>
                        </div>
                        <StatusBadge status={getTransactionStatusBadge(tx.status)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div>
                          <span className="text-muted-foreground">Payment:</span>{" "}
                          <span className="font-medium capitalize">{paymentMethodLabel(tx.payment_type)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{" "}
                          <span className="font-medium">{formatCurrency(tx.total_amount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>{" "}
                          <span className="font-medium">{new Date(tx.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {tx.status === 'WAITING_TO_PAYMENT' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleApprovePayment(tx.id)}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Confirm Payment
                        </Button>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">Tidak ada transaction</div>
                )}
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Total: {transactionTotal} transactions
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Rows per page:</Label>
                    <Select value={transactionPageSize.toString()} onValueChange={(value) => setTransactionPageSize(value === 'all' ? transactionTotal : parseInt(value))}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
              <div className="flex items-center flex-col sm:flex gap-2 justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Payment Methods
                </h4>
                <div className="flex-col md:flex gap-4">
                  {/* QRIS Button - Show Edit if exists, otherwise Create */}
                  {existingQris ? (
                    <Button size="sm" className="w-full my-1" variant="outline" onClick={handleOpenQris}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit QRIS
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full my-1" variant="outline" onClick={handleOpenQris}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah QRIS
                    </Button>
                  )}

                  {/* Transfer Button - Always Create (can be multiple) */}
                  {existingTransfer ? (
                    <Button size="sm" className="w-full my-1" variant="outline" onClick={handleOpenTransfer}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Transfer
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full my-1" variant="outline" onClick={handleOpenTransfer}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Transfer
                    </Button>
                  )}

                  {/* Cutoff Button - Show Edit if exists, otherwise Create */}
                  {existingCutoff ? (
                    <Button size="sm" className="w-full my-1" variant="outline" onClick={handleOpenCutoff}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Cutoff
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full my-1" variant="outline" onClick={handleOpenCutoff}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Cutoff
                    </Button>
                  )}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {store.payment_methods.map((pm) => (
                      <TableRow key={pm.id}>
                        <TableCell className="font-medium capitalize">
                          {pm.payment_type.replace('_', ' ')}
                        </TableCell>
                        <TableCell>
                          {pm.image_url && (
                            <img src={pm.image_url} alt={pm.payment_type} className="w-16 h-16 object-cover rounded mb-2" />
                          )}
                          {pm.payment_type === 'transfer_rekening' && pm.bank_name && (
                            <div className="text-sm">
                              <p className="font-medium">{pm.bank_name}</p>
                              <p className="text-muted-foreground">{pm.account_number}</p>
                              <p className="text-muted-foreground">a.n. {pm.account_name}</p>
                            </div>
                          )}
                          {pm.payment_type === 'qris' && pm.account_name && (
                            <p className="text-sm text-muted-foreground">a.n. {pm.account_name}</p>
                          )}
                          {pm.payment_type === 'cutoff_hutang' && (
                            <p className="text-sm text-muted-foreground">Cutoff / Hutang</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {pm.is_active ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">Inactive</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditPayment(pm)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openDeletePayment(pm)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {store.payment_methods.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Tidak ada payment method
                  </p>
                )}
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="md:hidden grid grid-cols-1 gap-4">
                {store.payment_methods.map((pm) => (
                  <div key={pm.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{pm.payment_type.replace('_', ' ')}</p>
                        {pm.is_active ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">Inactive</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPayment(pm)}>
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeletePayment(pm)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {pm.image_url && (
                      <img src={pm.image_url} alt={pm.payment_type} className="w-full h-32 object-cover rounded mb-2" />
                    )}
                    {pm.payment_type === 'transfer_rekening' && pm.bank_name && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">{pm.bank_name}</p>
                        <p>{pm.account_number}</p>
                        <p>a.n. {pm.account_name}</p>
                      </div>
                    )}
                    {pm.payment_type === 'qris' && pm.account_name && (
                      <p className="text-sm text-muted-foreground">
                        a.n. {pm.account_name}
                      </p>
                    )}
                  </div>
                ))}
                {store.payment_methods.length === 0 && (
                  <p className="text-sm text-muted-foreground">
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
            {/* <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input
                type="number"
                value={stockFormData.stock}
                onChange={(e) => setStockFormData({ ...stockFormData, stock: Number(e.target.value) })}
              />
            </div> */}
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
            <DialogTitle>
              {paymentMode === 'edit' ? 'Edit' : 'Tambah'} Payment Method
              {paymentFormData.payment_type === 'qris' && ' - QRIS'}
              {paymentFormData.payment_type === 'transfer_rekening' && ' - Transfer'}
              {paymentFormData.payment_type === 'cutoff_hutang' && ' - Cutoff'}
            </DialogTitle>
            <DialogDescription>
              {paymentFormData.payment_type === 'qris' && 'Upload gambar QRIS dan masukkan nama pemilik'}
              {paymentFormData.payment_type === 'transfer_rekening' && 'Masukkan detail rekening bank'}
              {paymentFormData.payment_type === 'cutoff_hutang' && 'Atur status aktif/nonaktif cutoff'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* QRIS Fields */}
            {paymentFormData.payment_type === 'qris' && (
              <>
                <div className="space-y-1.5">
                  <Label>Upload Gambar QRIS <span className="text-destructive">*</span></Label>
                  <div className="space-y-2">
                    {/* Preview Area */}
                    {qrisImagePreview && (
                      <div className="relative w-full max-w-[200px] mx-auto">
                        <img
                          src={qrisImagePreview}
                          alt="QRIS Preview"
                          className="w-full h-auto rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setQrisImageFile(null);
                            setQrisImagePreview(null);
                            setPaymentFormData({ ...paymentFormData, image_url: '' });
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* File Input */}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleQrisImageChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">Format: JPG, PNG, atau JPEG</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nama Pemilik <span className="text-destructive">*</span></Label>
                  <Input
                    value={paymentFormData.account_name}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, account_name: e.target.value })}
                    placeholder="Nama pemilik rekening/QRIS"
                  />
                </div>
              </>
            )}

            {/* Transfer Rekening Fields */}
            {paymentFormData.payment_type === 'transfer_rekening' && (
              <>
                <div className="space-y-1.5">
                  <Label>Nama Bank <span className="text-destructive">*</span></Label>
                  <Input
                    value={paymentFormData.bank_name}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, bank_name: e.target.value })}
                    placeholder="BCA, Mandiri, BNI, dll"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Rekening <span className="text-destructive">*</span></Label>
                  <Input
                    value={paymentFormData.account_number}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, account_number: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nama Pemilik Rekening <span className="text-destructive">*</span></Label>
                  <Input
                    value={paymentFormData.account_name}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, account_name: e.target.value })}
                    placeholder="Nama pemilik rekening"
                  />
                </div>
              </>
            )}

            {/* Cutoff Fields - Only status */}
            {paymentFormData.payment_type === 'cutoff_hutang' && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={paymentFormData.is_active ? 'true' : 'false'}
                  onValueChange={(v) => setPaymentFormData({ ...paymentFormData, is_active: v === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Aktif</SelectItem>
                    <SelectItem value="false">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Cutoff/Hutang tidak memerlukan input tambahan</p>
              </div>
            )}

            {/* Common: Status toggle for all types */}
            {paymentFormData.payment_type !== 'cutoff_hutang' && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={paymentFormData.is_active ? 'true' : 'false'}
                  onValueChange={(v) => setPaymentFormData({ ...paymentFormData, is_active: v === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Aktif</SelectItem>
                    <SelectItem value="false">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentMethodOpen(false)}>Batal</Button>
            <Button onClick={handlePaymentSave}>
              {paymentMode === 'edit' ? 'Update' : 'Simpan'}
            </Button>
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

      {/* Payment Approval Confirmation Dialog */}
      <Dialog open={approvePaymentOpen} onOpenChange={setApprovePaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment Approval</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this payment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setApprovePaymentOpen(false);
              setApprovingTransactionId(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmApprovePayment}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
