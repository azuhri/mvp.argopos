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
import { User, Pencil, Trash2, Eye, Search, ExternalLink, Upload, CreditCard, ArrowLeft, Save, X, Plus, Calendar, Package, ArrowUpDown, Users, Briefcase, Building2, DollarSign, Camera, CheckCircle, Clock, Store } from "lucide-react";
import { toast } from "sonner";
import { storeService } from "@/lib/services/storeService";
import { stockService } from "@/lib/services/stockService";
import { transactionService } from "@/lib/services/transactionService";
import { Store as StoreType, StoreAssignedUser, Transaction, StorePaymentMethod, Stock, TransactionCart, apiClient } from "@/lib/api";
import { config } from "@/lib/config";

export default function KoperasiDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreType | null>(null);
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
  const [summaryData, setSummaryData] = useState({
    total_transactions: 0,
    total_revenue: 0,
    internal_customers: 0,
    external_customers: 0
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

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
  const [transactionSearch, setTransactionSearch] = useState("");
  const [approvePaymentOpen, setApprovePaymentOpen] = useState(false);
  const [approvingTransactionId, setApprovingTransactionId] = useState<string | null>(null);
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

  // Time cutoff state
  const [timeCutoffOpen, setTimeCutoffOpen] = useState(false);
  const [timeCutoffSaving, setTimeCutoffSaving] = useState(false);
  const [timeCutoffForm, setTimeCutoffForm] = useState({
    time_open_store: '08:00',
    time_close_store: '20:00',
    time_start_pickup: '09:00',
    time_end_pickup: '18:00',
  });

  useEffect(() => {
    if (locationId) {
      loadStoreDetail();
      loadSummaryData();
    }
  }, [locationId]);

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
        image_url: payment.image_url ? config.endpointUrl + "/public/" + payment.image_url : '',
      }));
      console.log(data.payment_methods);

      setStore(data);

      // Set time cutoff form from store data
      setTimeCutoffForm({
        time_open_store: data.time_open_store || '08:00',
        time_close_store: data.time_close_store || '20:00',
        time_start_pickup: data.time_start_pickup || '09:00',
        time_end_pickup: data.time_end_pickup || '18:00',
      });
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
        value = 'Transfer Bank';
        break;
      default:
        value = paymentType;
    }
    return <Badge variant="secondary">{value}</Badge>;
  };

  const loadSummaryData = async () => {
    try {
      setSummaryLoading(true);

      // Use dashboard analytics API with custom date range and store_id filter
      const response = await apiClient.getDashboardAnalytics({
        range_days: 0,
        store_id: locationId,
        start_date: summaryStartDate,
        end_date: summaryEndDate,
      });

      if (response.success && response.data?.summary) {
        setSummaryData({
          total_transactions: response.data.summary.total_transactions || 0,
          total_revenue: response.data.summary.total_revenue || 0,
          internal_customers: response.data.summary.internal_customers || 0,
          external_customers: response.data.summary.external_customers || 0,
        });
      }
    } catch (error) {
      toast.error("Failed to load summary data");
      console.error(error);
    } finally {
      setSummaryLoading(false);
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

  const filteredTransactions = transactions.filter((tx) => {
    if (!transactionSearch) return true;
    const query = transactionSearch.toLowerCase();
    return (
      (tx.transaction_code || '').toLowerCase().includes(query) ||
      (tx.customer_name || '').toLowerCase().includes(query) ||
      (tx.payment_code || '').toLowerCase().includes(query)
    );
  });

  const totalTransactionPages = Math.max(1, Math.ceil(transactionTotal / transactionPageSize));

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

  const handleTransactionFilterChange = <T extends string>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setTransactionPage(1);
  };

  const closeCartModal = () => {
    setCartModalOpen(false);
    setCartModalTransaction(null);
    setCartModalItems([]);
  };

  const handleViewTransactionItems = async (transactionId: string) => {
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

  const handlePickupProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const response = await apiClient.uploadPickupProof(pickupProofTransaction.id, pickupProofFile);
      if (!response.success) throw new Error(response.message || 'Upload failed');
      toast.success('Bukti serah terima berhasil diupload');
      closePickupProofModal();
      loadTransactions();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setPickupProofUploading(false);
    }
  };

  const handleMarkReadyPickup = async (tx: Transaction) => {
    try {
      const res = await fetch(`${config.apiUrl}/api/v1/transactions/${tx.id}/mark-ready-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
      toast.success('Berhasil menandai siap diambil');
      loadTransactions();
    } catch (err: any) {
      toast.error(err.message || 'Gagal');
    }
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

  const handleTimeCutoffSave = async () => {
    if (!locationId) return;
    setTimeCutoffSaving(true);
    try {
      await apiClient.updateTimeCutoff(locationId, {
        time_open_store: timeCutoffForm.time_open_store,
        time_close_store: timeCutoffForm.time_close_store,
        time_start_pickup: timeCutoffForm.time_start_pickup,
        time_end_pickup: timeCutoffForm.time_end_pickup,
      });
      toast.success("Time cutoff settings updated successfully");
      setTimeCutoffOpen(false);
      loadStoreDetail();
    } catch (error) {
      toast.error("Failed to update time cutoff settings");
      console.error(error);
    } finally {
      setTimeCutoffSaving(false);
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
          <Button variant="outline" className="mt-4" onClick={() => navigate('/master/store')}>
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/master/store')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <Button
            variant={activeTab === 'summary' ? 'default' : 'outline'}
            onClick={() => setActiveTab('summary')}
            className="whitespace-nowrap"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Summary
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveTab('users')}
            className="whitespace-nowrap"
          >
            <Users className="h-4 w-4 mr-2" />
            User Assigned
          </Button>
          <Button
            variant={activeTab === 'transaction' ? 'default' : 'outline'}
            onClick={() => setActiveTab('transaction')}
            className="whitespace-nowrap"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Transaction
          </Button>
          <Button
            variant={activeTab === 'payment' ? 'default' : 'outline'}
            onClick={() => setActiveTab('payment')}
            className="whitespace-nowrap"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Method
          </Button>
          <Button
            variant={activeTab === 'time-cutoff' ? 'default' : 'outline'}
            onClick={() => setActiveTab('time-cutoff')}
            className="whitespace-nowrap"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Time Cutoff
          </Button>
        </div>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <GlassCard>
            <div className="p-1">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">Summary Metrics</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm">Start Date</Label>
                    <Input
                      type="date"
                      value={summaryStartDate}
                      onChange={(e) => setSummaryStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm">End Date</Label>
                    <Input
                      type="date"
                      value={summaryEndDate}
                      onChange={(e) => setSummaryEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={loadSummaryData}
                      disabled={summaryLoading}
                      className="w-full"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {summaryLoading ? 'Loading...' : 'Apply Filter'}
                    </Button>
                  </div>
                </div>
              </div>

              {summaryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center text-muted-foreground">Loading summary data...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-200/30 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Total Transaksi Berhasil</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      <AnimatedCounter end={summaryData.total_transactions} />
                    </p>
                  </div>
                  <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-200/30 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Building2 className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Revenue</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(summaryData.total_revenue)}</p>
                  </div>
                  <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-200/30 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Briefcase className="h-5 w-5 text-purple-600" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Customer Internal</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground"><AnimatedCounter end={summaryData.internal_customers} /></p>
                  </div>
                  <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-200/30 hover:shadow-lg transition-shadow md:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <Users className="h-5 w-5 text-orange-600" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Customer External</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground"><AnimatedCounter end={summaryData.external_customers} /></p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Product Stocks */}
          <GlassCard className="p-4">
            <div className="">
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
                                src={`${config.endpointUrl}/${stock.master_product.image_path}`}
                                alt={stock.master_product.product_name}
                                className="w-20 h-20 object-cover rounded-md"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center">
                                <Package className="h-10 w-10 text-muted-foreground" />
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
                            <Button variant="secondary" size="sm" onClick={() => openStockEdit(stock)}>
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
                      <div className="flex items-start gap-2">
                        {stock.master_product?.image_url ? (
                          <img
                            src={`${config.endpointUrl}/${stock.master_product.image_path}`}
                            alt={stock.master_product.product_name}
                            className="w-24 h-24 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-muted rounded-md flex items-center justify-center">
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
                          <div className="mt-3">
                            <Button variant="secondary" className="w-full" size="sm" onClick={() => openStockEdit(stock)}>
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
          <div className="space-y-4">
            <GlassCard>
              <div className="p-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Status</Label>
                    <Select value={transactionStatus} onValueChange={handleTransactionFilterChange(setTransactionStatus)}>
                      <SelectTrigger className="w-full">
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
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">User</Label>
                    <Select value={transactionUser} onValueChange={handleTransactionFilterChange(setTransactionUser)}>
                      <SelectTrigger className="w-full">
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
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Payment Method</Label>
                    <Select value={transactionPaymentMethod} onValueChange={handleTransactionFilterChange(setTransactionPaymentMethod)}>
                      <SelectTrigger className="w-full">
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
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Transaction Code</Label>
                    <Input
                      className="placeholder:text-xs"
                      placeholder="TRX-XXXXX"
                      value={transactionCode}
                      onChange={(e) => {
                        setTransactionCode(e.target.value);
                        setTransactionPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                    <div className="w-full flex flex-col items-start gap-2">
                      <Label className="text-sm">Start Date</Label>
                      <Input
                        type="date"
                        className="w-full"
                        value={transactionStartDate}
                        onChange={(e) => {
                          setTransactionStartDate(e.target.value);
                          setTransactionPage(1);
                        }}
                      />
                    </div>
                    <div className="w-full flex flex-col items-start gap-2">
                      <Label className="text-sm">End Date</Label>
                      <Input
                        type="date"
                        className="w-full"
                        value={transactionEndDate}
                        onChange={(e) => {
                          setTransactionEndDate(e.target.value);
                          setTransactionPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <Label className="text-sm">Sort by</Label>
                    <div className="flex gap-2">
                      <Select value={transactionSortBy} onValueChange={handleTransactionFilterChange(setTransactionSortBy)}>
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
                        onClick={() => setTransactionSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
                  <Input
                    className="pl-9 bg-card/70 backdrop-blur border-2 border-border/50"
                    placeholder="Search by code, customer, or payment code"
                    value={transactionSearch}
                    onChange={(e) => {
                      setTransactionSearch(e.target.value);
                      setTransactionPage(1);
                    }}
                  />
                </div>
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
                    ) : filteredTransactions.length > 0 ? (
                      filteredTransactions.map((tx) => (
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
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewTransactionItems(tx.id)}
                              >
                                <Eye className="h-3 w-3 mr-1" /> Items
                              </Button>
                              {tx.status === 'WAITING_TO_PAYMENT' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApprovePayment(tx.id)}
                                >
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Approve Payment
                                </Button>
                              )}
                              {(tx.status === 'PAID' || tx.status === 'PREPARING_PRODUCT') && !tx.path_proof_pickup && (
                                <Button
                                  size="sm"
                                  className="bg-blue-500 hover:bg-blue-600 text-white"
                                  onClick={() => openPickupProofModal(tx)}
                                >
                                  <Camera className="h-3 w-3 mr-1" />
                                  Upload Bukti
                                </Button>
                              )}
                              {tx.path_proof_pickup && (
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                  onClick={() => handleMarkReadyPickup(tx)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Siap Diambil
                                </Button>
                              )}
                            </div>
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
            </GlassCard>

            {/* Mobile: Card View */}
            <div className="md:hidden space-y-3">
              {transactionsLoading ? (
                <div className="text-center text-muted-foreground py-4">Loading...</div>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
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
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleViewTransactionItems(tx.id)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View Items
                      </Button>
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
                      {(tx.status === 'PAID' || tx.status === 'PREPARING_PRODUCT') && !tx.path_proof_pickup && (
                        <Button
                          size="sm"
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={() => openPickupProofModal(tx)}
                        >
                          <Camera className="h-3 w-3 mr-1" />
                          Upload Bukti
                        </Button>
                      )}
                      {tx.path_proof_pickup && (
                        <Button
                          size="sm"
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleMarkReadyPickup(tx)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Siap Diambil
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">Tidak ada transaction</div>
              )}
            </div>

            <GlassCard>
              <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredTransactions.length} of {transactionTotal} transactions
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex flex-row items-center gap-2">
                    <span className="text-sm">Rows:</span>
                    <Select
                      value={transactionPageSize.toString()}
                      onValueChange={(value) => {
                        setTransactionPageSize(Number(value));
                        setTransactionPage(1);
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
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={transactionPage <= 1}
                      onClick={() => setTransactionPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {transactionPage} / {totalTransactionPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={transactionPage >= totalTransactionPages}
                      onClick={() => setTransactionPage((prev) => prev + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

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
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePickupProofFileChange} />
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
        </TabsContent>

        {/* Payment Method Tab */}
        <TabsContent value="payment">
          <GlassCard>
            <div className="p-4 md:p-6">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h4 className="font-semibold flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5" />
                  Payment Methods
                </h4>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  {/* QRIS Button */}
                  {existingQris ? (
                    <Button size="sm" variant="outline" onClick={handleOpenQris} className="w-full sm:w-auto">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit QRIS
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleOpenQris} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah QRIS
                    </Button>
                  )}

                  {/* Transfer Button */}
                  {existingTransfer ? (
                    <Button size="sm" variant="outline" onClick={handleOpenTransfer} className="w-full sm:w-auto">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Transfer
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleOpenTransfer} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Transfer
                    </Button>
                  )}

                  {/* Cutoff Button */}
                  {existingCutoff ? (
                    <Button size="sm" variant="outline" onClick={handleOpenCutoff} className="w-full sm:w-auto">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Cutoff
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleOpenCutoff} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Cutoff
                    </Button>
                  )}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Tipe</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px] text-right">Aksi</TableHead>
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
                            <img src={pm.image_url} alt={pm.payment_type} className="w-20 h-20 object-cover rounded-lg mb-2 border" />
                          )}
                          {pm.payment_type === 'transfer_rekening' && pm.bank_name && (
                            <div className="text-sm space-y-1">
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
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
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
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">Tidak ada payment method</p>
                  </div>
                )}
              </div>

              {/* Tablet Grid View */}
              <div className="hidden md:block lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                {store.payment_methods.map((pm) => (
                  <div key={pm.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{pm.payment_type.replace('_', ' ')}</p>
                        {pm.is_active ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPayment(pm)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeletePayment(pm)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {pm.image_url && (
                      <img src={pm.image_url} alt={pm.payment_type} className="w-24 h-24 object-cover rounded-lg mb-3 border" />
                    )}
                    {pm.payment_type === 'transfer_rekening' && pm.bank_name && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">{pm.bank_name}</p>
                        <p>{pm.account_number}</p>
                        <p>a.n. {pm.account_name}</p>
                      </div>
                    )}
                    {pm.payment_type === 'qris' && pm.account_name && (
                      <p className="text-sm text-muted-foreground">a.n. {pm.account_name}</p>
                    )}
                  </div>
                ))}
                {store.payment_methods.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-sm text-muted-foreground">Tidak ada payment method</p>
                  </div>
                )}
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid grid-cols-1 gap-4">
                {store.payment_methods.map((pm) => (
                  <div key={pm.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium capitalize">{pm.payment_type.replace('_', ' ')}</p>
                        {pm.is_active ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPayment(pm)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeletePayment(pm)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {pm.image_url && (
                      <img src={pm.image_url} alt={pm.payment_type} className="w-full h-32 object-cover rounded-lg mb-3 border" />
                    )}
                    {pm.payment_type === 'transfer_rekening' && pm.bank_name && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">{pm.bank_name}</p>
                        <p>{pm.account_number}</p>
                        <p>a.n. {pm.account_name}</p>
                      </div>
                    )}
                    {pm.payment_type === 'qris' && pm.account_name && (
                      <p className="text-sm text-muted-foreground">a.n. {pm.account_name}</p>
                    )}
                    {pm.payment_type === 'cutoff_hutang' && (
                      <p className="text-sm text-muted-foreground">Cutoff / Hutang</p>
                    )}
                  </div>
                ))}
                {store.payment_methods.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">Tidak ada payment method</p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* Time Cutoff Tab */}
        <TabsContent value="time-cutoff" className="space-y-4">
          <GlassCard>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Pengaturan Waktu Operasional
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Atur jam operasional toko dan waktu pengambilan barang
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTimeCutoffOpen(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Waktu
                </Button>
              </div>

              {/* Current Settings Display */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Store Operational Hours */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Store className="h-5 w-5 text-primary" />
                    <h4 className="font-medium">Jam Operasional Toko</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Jam Buka</Label>
                      <p className="text-2xl font-bold text-primary">
                        {store.time_open_store || '08:00'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Jam Tutup</Label>
                      <p className="text-2xl font-bold text-primary">
                        {store.time_close_store || '20:00'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pickup Time Window */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium">Waktu Pengambilan</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Mulai</Label>
                      <p className="text-2xl font-bold text-green-600">
                        {store.time_start_pickup || '09:00'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Selesai</Label>
                      <p className="text-2xl font-bold text-green-600">
                        {store.time_end_pickup || '18:00'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Time Display */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Waktu Sekarang:</span>
                  </div>
                  <p className="text-lg font-mono font-bold">
                    {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>

      {/* Transaction Items Modal */}
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
                      src={`${config.endpointUrl}/${item.product_details.image_path}`}
                      alt={item.product_details?.product_name || 'Product'}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
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

      {/* Stock Edit Dialog */}
      <Dialog open={stockEditOpen} onOpenChange={setStockEditOpen}>
        <DialogContent className="sm:max-w-md px-6">
          <DialogHeader>
            <DialogTitle>Edit Product Stock</DialogTitle>
            <DialogDescription>Update harga dan pajak untuk produk ini</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input
                type="number"
                value={stockFormData.stock}
                onChange={(e) => setStockFormData({ ...stockFormData, stock: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Store Price</Label>
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

      {/* Time Cutoff Edit Dialog */}
      <Dialog open={timeCutoffOpen} onOpenChange={setTimeCutoffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengaturan Waktu</DialogTitle>
            <DialogDescription>
              Atur jam operasional dan waktu pengambilan barang
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Store Operational Hours */}
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Store className="h-4 w-4" />
                Jam Operasional Toko
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Jam Buka</Label>
                  <Input
                    type="time"
                    value={timeCutoffForm.time_open_store}
                    onChange={(e) => setTimeCutoffForm({ ...timeCutoffForm, time_open_store: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Jam Tutup</Label>
                  <Input
                    type="time"
                    value={timeCutoffForm.time_close_store}
                    onChange={(e) => setTimeCutoffForm({ ...timeCutoffForm, time_close_store: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Pickup Time Window */}
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Waktu Pengambilan Barang
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mulai</Label>
                  <Input
                    type="time"
                    value={timeCutoffForm.time_start_pickup}
                    onChange={(e) => setTimeCutoffForm({ ...timeCutoffForm, time_start_pickup: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Selesai</Label>
                  <Input
                    type="time"
                    value={timeCutoffForm.time_end_pickup}
                    onChange={(e) => setTimeCutoffForm({ ...timeCutoffForm, time_end_pickup: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeCutoffOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleTimeCutoffSave} disabled={timeCutoffSaving}>
              {timeCutoffSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
