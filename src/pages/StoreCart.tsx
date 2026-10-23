import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  ImageOff,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { getCartSummary, updateCartQty, removeFromCart, clearCart } from "@/lib/storefront";
import { formatCurrency } from "@/lib/mockData";
import { config } from "@/lib/config";
import { toast } from "sonner";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { CartItemSkeleton, CartSummarySkeleton, LoadingSpinner } from "@/components/shared/SkeletonLoader";
import { useQuery } from "@tanstack/react-query";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { upsertPendingPayment } from "@/lib/pendingPaymentStorage";
import { paymentService, validatedCheckoutUrl } from "@/lib/services/paymentService";
import { getStorePaymentSettings, storePaymentSettingsQueryKey } from "@/lib/services/storePaymentSettingsService";
import { DokuMethodDialog } from "@/components/commerce/DokuMethodDialog";

interface ProductStock {
  id: string;
  stock: number;
  base_price: number;
  discount_price: number;
  final_price: number;
  master_product: {
    id: string;
    product_name: string;
    product_code: string;
    image_path: string;
    image_url: string;
    category?: string;
  };
}

interface StoreData {
  location_id: string;
  location_name: string;
  location_code: string;
  total_stock: number;
  product_stores: ProductStock[];
  payment_methods?: PaymentMethod[];
  time_start_pickup?: string;
  time_end_pickup?: string;
}

interface PaymentMethod {
  id: string;
  location_id: string;
  payment_type: string;
  image_url: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
}

interface OperationalStatus {
  is_open: boolean;
  current_time: string;
  store_open_time?: string;
  store_close_time?: string;
  pickup_start_time?: string;
  pickup_end_time?: string;
  is_within_pickup_window: boolean;
  message?: string;
}

interface CreateTransactionRequest {
  master_location_id: string;
  base_amount?: number;
  total_item: number;
  payment_method_id?: string;
  payment_provider?: "DOKU";
  doku_payment_method?: string;
  nominal_code?: string;
  carts: Array<{
    product_stock_id: string;
    amount?: number;
    qty: number;
  }>;
  customer_name?: string;
  employee_code?: string;
  no_wa?: string;
  email?: string;
}

interface CheckoutTransaction {
  id: string;
  status: string;
  transaction_code?: string;
  total_amount: number;
  created_at: string;
  expires_at?: string;
}

function persistPendingCheckout(
  transaction: CheckoutTransaction,
  storeData: StoreData,
  locationCode?: string,
) {
  if (transaction.status !== "WAITING_TO_PAYMENT") return false;

  return upsertPendingPayment({
    transaction_id: transaction.id,
    transaction_code: transaction.transaction_code || transaction.id,
    location_code: storeData.location_code || locationCode || "",
    location_name: storeData.location_name,
    total_amount: Number(transaction.total_amount),
    status: transaction.status,
    created_at: transaction.created_at,
    expires_at: transaction.expires_at || "",
  });
}

async function fetchTransactionDetail(transactionId: string) {
  try {
    const response = await fetch(`${config.apiUrl}/transactions/${transactionId}`);
    if (!response.ok) return null;

    const result = await response.json() as { data?: CheckoutTransaction };
    return result.data && typeof result.data === "object" ? result.data : null;
  } catch {
    return null;
  }
}

function getPaymentMethodLabel(paymentType: string) {
  if (paymentType === "DOKU") return "DOKU — pembayaran online";
  if (paymentType === "qris") return "QRIS";
  if (paymentType === "transfer_rekening") return "Transfer Rekening";
  if (paymentType === "cutoff_hutang") return "Cutoff / Hutang";
  return paymentType;
}

function PaymentMethodIcon({ paymentType }: { paymentType: string }) {
  if (paymentType === "qris") return <QrCode className="h-5 w-5" />;
  if (paymentType === "transfer_rekening") return <CreditCard className="h-5 w-5" />;
  return <Wallet className="h-5 w-5" />;
}

export default function StoreCart() {
  const { locationCode } = useParams<{ locationCode: string }>();
  const navigate = useNavigate();
  const [cart, setCart] = useState(getCartSummary());
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [dokuMethodDialogOpen, setDokuMethodDialogOpen] = useState(false);
  const [selectedDokuMethod, setSelectedDokuMethod] = useState<string | null>(null);
  const [dokuSelectionError, setDokuSelectionError] = useState("");
  const [dokuPickupAcknowledged, setDokuPickupAcknowledged] = useState(false);
  const [pickupTimeAlert, setPickupTimeAlert] = useState<{
    show: boolean;
    message: string;
    pickupStart: string;
    pickupEnd: string;
  } | null>(null);

  // Customer information form state
  const [isInternalCustomer, setIsInternalCustomer] = useState(false);
  const [employeeCodeOrNIK, setEmployeeCodeOrNIK] = useState('');
  const [isValidatingEmployee, setIsValidatingEmployee] = useState(false);
  const [isEmployeeValid, setIsEmployeeValid] = useState<boolean | null>(null);
  const [externalCustomer, setExternalCustomer] = useState({
    name: '',
    email: '',
    nowa: ''
  });
  const [isExternalCustomerExists, setIsExternalCustomerExists] = useState(false);
  const [isValidatingExternal, setIsValidatingExternal] = useState(false);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [isOpeningDokuCheckout, setIsOpeningDokuCheckout] = useState(false);
  const checkoutSubmitting = useRef(false);
  const employeeValidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const externalValidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track image loading states for cart items
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  const handleImageLoad = (productId: string) => {
    setImageLoaded(prev => ({ ...prev, [productId]: true }));
  };

  const handleImageError = (productId: string) => {
    setImageLoaded(prev => ({ ...prev, [productId]: true }));
    setImageError(prev => ({ ...prev, [productId]: true }));
  };

  // Fetch store data from backend API
  const { data: storeData, error, isLoading: storeLoading } = useQuery({
    queryKey: ['store', locationCode],
    queryFn: async () => {
      const endpoint = `${config.apiUrl}/${locationCode}/store`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch store data');
      }
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: !!locationCode,
  });

  const paymentSettingsQuery = useQuery({
    queryKey: storePaymentSettingsQueryKey(storeData?.location_id || ""),
    queryFn: () => getStorePaymentSettings(storeData!.location_id),
    enabled: Boolean(storeData?.location_id),
    retry: false,
  });
  const paymentSettings = paymentSettingsQuery.data;
  const isDokuMode = paymentSettings?.payment_mode === "DOKU";
  const dokuMethods = useMemo(() => [...new Set((paymentSettings?.doku_methods || []).filter((method) => typeof method === "string" && method.trim()))], [paymentSettings?.doku_methods]);
  const paymentSettingsUnavailable = !paymentSettings || Boolean(paymentSettingsQuery.error) || (isDokuMode && (!paymentSettings.doku_available || dokuMethods.length === 0));

  useEffect(() => {
    if (!isDokuMode) {
      setDokuMethodDialogOpen(false);
      setSelectedDokuMethod(null);
    } else if (selectedDokuMethod && !dokuMethods.includes(selectedDokuMethod)) {
      setSelectedDokuMethod(null);
      setDokuSelectionError("Metode pembayaran yang dipilih sudah tidak tersedia. Pilih metode lain.");
    }
  }, [isDokuMode, dokuMethods, selectedDokuMethod]);

  // Manual methods remain stored when an outlet switches to DOKU.
  const { data: paymentMethods, isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ['paymentMethods', storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return [];
      const endpoint = `${config.apiUrl}/stores/${storeData.location_id}/payment-methods`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }
      const result = await response.json();
      return result.data as PaymentMethod[];
    },
    enabled: Boolean(storeData?.location_id) && paymentSettings?.payment_mode === "MANUAL",
  });

  // Fetch operational status for pickup time check
  const { data: operationalStatus } = useQuery({
    queryKey: ['operationalStatus', storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return null;
      const response = await apiClient.getOperationalStatus(storeData.location_id);
      if (!response.success || !response.data) {
        return null;
      }
      return response.data as OperationalStatus;
    },
    enabled: !!storeData?.location_id,
    refetchInterval: 60000, // Check every minute
  });

  // Update cart summary when storeData loads
  useEffect(() => {
    if (storeData) {
      const products = storeData.product_stores.map(p => ({
        id: p.id,
        name: p.master_product.product_name,
        price: p.base_price,
        stock: p.stock,
      }));
      setCart(getCartSummary(products));
    }
  }, [storeData]);


  const findProductById = (productId: string) => {
    return storeData?.product_stores.find(p => p.id === productId);
  }

  // Update cart summary when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      if (storeData) {
        const products = storeData.product_stores.map(p => ({
          id: p.id,
          name: p.master_product.product_name,
          price: p.base_price,
          stock: p.stock,
        }));
        setCart(getCartSummary(products));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [storeData]);

  const { items, total, totalItems } = cart;
  const totalTax = items.reduce((sum, item) => {
    const priceWithTax = item.productPrice || item.product.price || 0;
    const taxPercentage = item.tax_percentage || 0;
    if (taxPercentage <= 0) return sum;
    return sum + (priceWithTax - priceWithTax / (1 + taxPercentage / 100)) * item.qty;
  }, 0);

  const handleUpdateQty = (productId: string, newQty: number) => {
    const product = findProductById(productId);

    if (newQty < 0) return;

    setUpdating(productId);

    if (newQty === 0) {
      removeFromCart(productId);
      toast.success("Produk dihapus dari keranjang");
    } else {
      if (product && newQty > product.stock) {
        setUpdating(null);
        toast.error("Stok tidak mencukupi");
        return;
      }
      const result = updateCartQty(productId, newQty);
      if (!result.success) {
        toast.error(result.message);
      }
    }
    // Refresh cart after update
    refreshCart();
    setUpdating(null);
  };

  const refreshCart = () => {
    if (storeData) {
      const products = storeData.product_stores.map(p => ({
        id: p.id,
        name: p.master_product.product_name,
        price: p.base_price,
        stock: p.stock,
      }));
      setCart(getCartSummary(products));
    }
  };

  const handleClearCart = () => {
    clearCart();
    refreshCart();
    toast.success("Keranjang dikosongkan");
  };

  // Validate employee code or NIK
  const validateEmployee = async (code: string) => {
    if (!code.trim()) {
      setIsEmployeeValid(null);
      return;
    }

    setIsValidatingEmployee(true);

    try {
      const response = await fetch(`${config.apiUrl}/users/check-valid-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_code_or_nik: code.trim()
        })
      });

      const result = await response.json();

      if (result.success && result.is_valid) {
        setIsEmployeeValid(true);
      } else {
        setIsEmployeeValid(false);
      }
    } catch {
      setIsEmployeeValid(false);
    } finally {
      setIsValidatingEmployee(false);
    }
  };

  // Handle employee code/NIK input change
  const handleEmployeeCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmployeeCodeOrNIK(value);
    if (employeeValidationTimer.current) clearTimeout(employeeValidationTimer.current);
    employeeValidationTimer.current = setTimeout(() => validateEmployee(value), 800);
  };

  // Validate external customer by no_wa
  const validateExternalCustomer = async (no_wa: string) => {
    if (!no_wa.trim()) {
      setIsExternalCustomerExists(false);
      return;
    }

    setIsValidatingExternal(true);

    try {
      const response = await fetch(`${config.apiUrl}/transactions/check-customer-by-no-wa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ no_wa: no_wa.trim() })
      });

      const result = await response.json();

      if (result.success && result.exists) {
        setIsExternalCustomerExists(true);
        setExternalCustomer(prev => ({
          ...prev,
          name: result.customer.customer_name || '',
          email: result.customer.email || ''
        }));
      } else {
        setIsExternalCustomerExists(false);
      }
    } catch {
      setIsExternalCustomerExists(false);
    } finally {
      setIsValidatingExternal(false);
    }
  };

  // Handle external customer no_wa input change
  const handleExternalNoWAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setExternalCustomer(prev => ({ ...prev, nowa: value }));
    if (externalValidationTimer.current) clearTimeout(externalValidationTimer.current);
    externalValidationTimer.current = setTimeout(() => validateExternalCustomer(value), 800);
  };

  useEffect(() => {
    return () => {
      if (employeeValidationTimer.current) clearTimeout(employeeValidationTimer.current);
      if (externalValidationTimer.current) clearTimeout(externalValidationTimer.current);
    };
  }, []);

  // Create transaction
  const handleCreateTransaction = async (bypassPickupTimeCheck = false, dokuConfirmed = false) => {
    if (checkoutSubmitting.current) return;
    if (paymentSettingsUnavailable) {
      toast.error("Pembayaran outlet belum tersedia. Periksa kembali beberapa saat lagi.");
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('Pilih metode pembayaran terlebih dahulu');
      return;
    }
    if (isDokuMode && dokuConfirmed && (!selectedDokuMethod || !dokuMethods.includes(selectedDokuMethod))) {
      setDokuSelectionError("Pilih metode pembayaran DOKU terlebih dahulu.");
      return;
    }

    // Check if within pickup window (skip if user already acknowledged)
    if (operationalStatus && !operationalStatus.is_within_pickup_window && !bypassPickupTimeCheck) {
      const currentTime = operationalStatus.current_time;
      const pickupStart = operationalStatus.pickup_start_time || storeData?.time_start_pickup || '09:00';
      const pickupEnd = operationalStatus.pickup_end_time || storeData?.time_end_pickup || '18:00';

      let message = '';
      if (currentTime < pickupStart.substring(0, 5)) {
        message = `Pengambilan barang dapat dilakukan mulai jam ${pickupStart.substring(0, 5)}`;
      } else {
        message = `Waktu pengambilan sudah lewat. Silakan ambil besok pada jam ${pickupStart.substring(0, 5)} - ${pickupEnd.substring(0, 5)}`;
      }

      setPickupTimeAlert({
        show: true,
        message: message,
        pickupStart: pickupStart.substring(0, 5),
        pickupEnd: pickupEnd.substring(0, 5),
      });
      return;
    }

    if (isInternalCustomer) {
      if (!isEmployeeValid) {
        toast.error('Validasi employee terlebih dahulu');
        return;
      }
    } else {
      if (!externalCustomer.nowa.trim()) {
        toast.error('No WA harus diisi');
        return;
      }
      if (!externalCustomer.email.trim()) {
        toast.error('Email harus diisi');
        return;
      }

      // Only require the name when the customer does not exist yet.
      if (!isExternalCustomerExists) {
        if (!externalCustomer.name.trim()) {
					toast.error('Nama harus diisi untuk customer baru');
          return;
        }
      }
    }

    if (isDokuMode && !dokuConfirmed) {
      setSelectedDokuMethod(null);
      setDokuSelectionError("");
      setDokuPickupAcknowledged(bypassPickupTimeCheck);
      setDokuMethodDialogOpen(true);
      return;
    }

    checkoutSubmitting.current = true;
    setIsCreatingTransaction(true);

    try {
      const currentSettings = await paymentSettingsQuery.refetch();
      if (currentSettings.error || !currentSettings.data ||
          (currentSettings.data.payment_mode === "DOKU") !== (selectedPaymentMethod === "DOKU") ||
          (currentSettings.data.payment_mode === "DOKU" && !currentSettings.data.doku_available)) {
        setDokuSelectionError("Pengaturan pembayaran outlet berubah atau belum tersedia. Periksa kembali pilihan pembayaran.");
        toast.error("Pengaturan pembayaran outlet berubah atau belum tersedia. Periksa metode pembayaran sebelum melanjutkan.");
        return;
      }
      if (currentSettings.data.payment_mode === "DOKU" &&
          (!dokuConfirmed || !selectedDokuMethod || !currentSettings.data.doku_methods.includes(selectedDokuMethod))) {
        setSelectedDokuMethod(null);
        setDokuSelectionError("Metode pembayaran yang dipilih sudah tidak tersedia. Pilih metode lain.");
        return;
      }

      // Prepare cart items
      const carts = cart.items.map(item => ({
        product_stock_id: item.productId,
        amount: item.product.price * item.qty,
        qty: item.qty
      }));

      // Generate nominal code (random 2 digit)
      const nominalCode = Math.floor(10 + Math.random() * 90).toString();

      // Prepare transaction request
      if (!storeData) {
        toast.error("Data outlet belum tersedia");
        return;
      }

      const transactionRequest: CreateTransactionRequest = {
        master_location_id: storeData.location_id,
        base_amount: cart.total,
        total_item: cart.totalItems,
        payment_method_id: selectedPaymentMethod,
        nominal_code: nominalCode,
        carts: carts
      };

      if (selectedPaymentMethod === "DOKU") {
        transactionRequest.payment_provider = "DOKU";
        transactionRequest.doku_payment_method = selectedDokuMethod!;
        delete transactionRequest.payment_method_id;
        delete transactionRequest.nominal_code;
        delete transactionRequest.base_amount;
        transactionRequest.carts = carts.map(({ product_stock_id, qty }) => ({ product_stock_id, qty }));
      }

      // Add customer information based on type
      if (isInternalCustomer) {
        transactionRequest.customer_name = employeeCodeOrNIK.trim();
        transactionRequest.employee_code = employeeCodeOrNIK.trim();
      } else {
        transactionRequest.customer_name = externalCustomer.name.trim();
        transactionRequest.no_wa = externalCustomer.nowa.trim();
        transactionRequest.email = externalCustomer.email.trim();
      }

      // Create transaction via API
      const response = await fetch(`${config.apiUrl}/transactions`, {
        method: 'POST',
        credentials: transactionRequest.payment_provider === "DOKU" ? "include" : "same-origin",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionRequest)
      });

      if (!response.ok) throw new Error("Gagal membuat transaksi");

      const result = await response.json() as {
        success?: boolean;
        data?: CheckoutTransaction;
      };

      if (result.success && result.data) {
        if (result.data.status === "WAITING_TO_PAYMENT") {
          let isPersisted = persistPendingCheckout(result.data, storeData, locationCode);

          if (!isPersisted) {
            const canonicalTransaction = await fetchTransactionDetail(result.data.id);
            if (canonicalTransaction) {
              isPersisted = persistPendingCheckout(
                canonicalTransaction,
                storeData,
                locationCode,
              );
            }
          }

          if (!isPersisted) {
            toast.warning(
              "Transaksi berhasil dibuat, tetapi pemulihan pembayaran belum tersimpan. Selesaikan pembayaran pada halaman berikutnya.",
            );
          }
        }

        const paymentPath = `/${locationCode}/commerce/payment/${result.data.id}`;
        if (transactionRequest.payment_provider === "DOKU") {
          setIsOpeningDokuCheckout(true);
          clearCart();
          try {
            const payment = await paymentService.createCheckout(result.data.id);
            if (payment.status === "PENDING" && payment.checkout_url && !payment.verification_pending &&
                !payment.review_required && !["CREATING", "UNCERTAIN"].includes(payment.creation_state || "") &&
                Date.parse(payment.expires_at) > Date.now()) {
              const checkoutUrl = validatedCheckoutUrl(payment.checkout_url);
              window.location.assign(checkoutUrl);
              return;
            }
          } catch {
            toast.warning("Pesanan sudah dibuat. Periksa status pembayaran pada detail transaksi sebelum mencoba kembali.");
          }
          setIsOpeningDokuCheckout(false);
          navigate(paymentPath);
          return;
        }

        toast.success('Transaksi berhasil dibuat');
        clearCart();
        navigate(paymentPath);
      } else {
        toast.error('Gagal membuat transaksi');
      }
    } catch {
      toast.error('Gagal membuat transaksi');
    } finally {
      checkoutSubmitting.current = false;
      setIsCreatingTransaction(false);
    }
  };

  // Filter payment methods based on customer type
  const filteredPaymentMethods = useMemo(() => {
    if (!paymentSettings || paymentSettingsQuery.error) return [];
    if (paymentSettings.payment_mode === "DOKU") return [{
      id: "DOKU", location_id: storeData?.location_id || "", payment_type: "DOKU",
      image_url: "", bank_name: "", account_number: "", account_name: "", is_active: true,
    }];
    return paymentMethods?.filter(pm => {
      if (!pm.is_active || pm.payment_type.toUpperCase() === "DOKU") return false;
      // Cutoff/hutang only available for internal customers who are validated.
      if (pm.payment_type === 'cutoff_hutang' && (!isInternalCustomer || isEmployeeValid !== true)) return false;
      return true;
    }) || [];
  }, [paymentSettings, paymentSettingsQuery.error, isEmployeeValid, isInternalCustomer, paymentMethods, storeData?.location_id]);

  useEffect(() => {
    if (isDokuMode && !paymentSettingsUnavailable) {
      setSelectedPaymentMethod("DOKU");
      return;
    }
    if (paymentSettingsUnavailable) {
      setSelectedPaymentMethod(null);
      return;
    }
    if (!selectedPaymentMethod) return;
    const remainsAvailable = filteredPaymentMethods.some((method) => method.id === selectedPaymentMethod);
    if (!remainsAvailable) setSelectedPaymentMethod(null);
  }, [filteredPaymentMethods, selectedPaymentMethod, isDokuMode, paymentSettingsUnavailable]);

  // Reset employee validation when switching customer type
  useEffect(() => {
    setIsEmployeeValid(null);
    setEmployeeCodeOrNIK('');
  }, [isInternalCustomer]);

  if (storeLoading) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="mx-auto w-full max-w-[1180px] py-4 md:py-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-md bg-slate-200" />
            <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CartItemSkeleton key={i} />
              ))}
            </div>
            <div>
              <CartSummarySkeleton />
            </div>
          </div>
        </div>
      </AppLayoutCommerce>
    );
  }

  if (error || !storeData) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-red-50 text-[#e30613]">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-xl font-extrabold text-[#071a4f]">Outlet tidak dapat dimuat</h2>
          <p className="mb-6 text-sm text-slate-500">Periksa koneksi lalu kembali ke katalog untuk memilih outlet.</p>
          <Button asChild className="rounded-md bg-[#071a4f] hover:bg-[#102866]">
            <Link to="/commerce">Kembali ke katalog</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  if (isOpeningDokuCheckout) {
    return <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ""}>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center" role="status">
        <LoadingSpinner />
        <h1 className="text-xl font-extrabold text-[#071a4f]">Menyiapkan pembayaran DOKU</h1>
        <p className="text-sm text-slate-600">Pesanan Anda sudah tersimpan. Tunggu hingga halaman pembayaran terbuka.</p>
      </div>
    </AppLayoutCommerce>;
  }

  if (items.length === 0) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-[#071a4f]">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-xl font-extrabold text-[#071a4f]">Keranjang masih kosong</h2>
          <p className="mb-6 text-sm text-slate-500">Pilih produk dari katalog sebelum melanjutkan checkout.</p>
          <Button asChild className="rounded-md bg-[#e30613] hover:bg-[#c70510]">
            <Link to="/commerce">Mulai belanja</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
          <Button variant="ghost" size="sm" asChild className="mb-3 -ml-3 rounded-md font-bold text-slate-600">
            <Link to={`/commerce`}>
              <ArrowLeft className="h-4 w-4" />
              Kembali Belanja
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold text-[#071a4f] md:text-3xl">Keranjang belanja</h1>
            {storeData && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                <MapPin className="h-4 w-4 text-[#e30613]" />
                <span>{storeData.location_name} ({storeData.location_code})</span>
              </div>
            )}
          </div>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
            <span className="text-[#071a4f]">1. Keranjang</span>
            <span aria-hidden="true">/</span>
            <span>2. Pembayaran</span>
            <span aria-hidden="true">/</span>
            <span>3. Selesai</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
          <div className="space-y-4">
            <div className="commerce-panel overflow-hidden px-4 pb-1 pt-1 md:px-5">
              <div className="flex items-center justify-between border-b border-slate-200 py-4">
                <div>
                  <h2 className="font-extrabold text-[#071a4f]">Produk pilihan</h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{totalItems} item dari {storeData.location_name}</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-md text-[#e30613] hover:bg-red-50 hover:text-[#c70510]" onClick={handleClearCart}>
                  <Trash2 className="h-4 w-4" />
                  Kosongkan
                </Button>
              </div>
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div
                    key={item.productId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <GlassCard className="my-0 !rounded-none !border-0 !bg-white !px-0 !py-4 !shadow-none transition-all md:!py-5">
                      {/* Container Utama: CSS Grid di Mobile, Flex Row di Desktop */}
                      <div className="grid grid-cols-[1fr_auto] md:flex md:flex-row md:items-center md:justify-between gap-3 md:gap-4">

                        {/* 1. Product Image & Info (Mobile: Atas Kiri | Desktop: Paling Kiri) */}
                        <div className="flex flex-col">
                          <div className="flex items-start gap-3 md:gap-4 min-w-0">
                            <div className="commerce-product-visual relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 md:h-24 md:w-24">
                              {/* Skeleton - always behind image during loading */}
                              {(!imageLoaded[item.productId] && !imageError[item.productId]) && (
                                <div className="absolute inset-0 z-10 animate-pulse bg-slate-100" />
                              )}

                              {/* Image with fade-in */}
                              {!imageError[item.productId] && (
                                <img
                                  src={item.product.image_url}
                                  alt={item.product.name}
                                  className={`
                                    w-full h-full object-contain p-2
                                    transition-opacity duration-300 ease-out
                                    ${imageLoaded[item.productId] ? 'opacity-100' : 'opacity-0'}
                                  `}
                                  onLoad={() => handleImageLoad(item.productId)}
                                  onError={() => handleImageError(item.productId)}
                                />
                              )}

                              {/* Error fallback */}
                              {imageError[item.productId] && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
                                  <ImageOff className="h-5 w-5 text-slate-300" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 pt-0.5 md:pt-0">
                              <h3 className="mb-1 line-clamp-2 text-sm font-extrabold leading-tight text-[#071a4f] md:text-base">
                                {item.product.name}
                              </h3>
                              <p className="text-xs font-bold text-[#071a4f] md:text-sm">
                                {formatCurrency(item.product.price)}
                              </p>
                              <p className="text-xs font-semibold text-emerald-700">
                                Stok tersedia: {findProductById(item.productId)?.stock ?? 0}
                              </p>
                              <div className="flex mt-2 items-start md:items-center">
                                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-sm p-0 text-[#071a4f] hover:bg-slate-200 md:h-8 md:w-8"
                                    onClick={() => handleUpdateQty(item.productId, item.qty - 1)}
                                    disabled={updating === item.productId}
                                    aria-label={`Kurangi ${item.product.name}`}
                                  >
                                    {updating === item.productId ? (
                                      <LoadingSpinner size="sm" />
                                    ) : (
                                      <Minus className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <span className="w-6 text-center text-sm font-extrabold text-[#071a4f] md:w-8">
                                    {item.qty}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-sm p-0 text-[#071a4f] hover:bg-slate-200 md:h-8 md:w-8"
                                    onClick={() => handleUpdateQty(item.productId, item.qty + 1)}
                                    disabled={updating === item.productId || (item.product?.stock !== undefined && item.qty >= item.product.stock)}
                                    aria-label={`Tambah ${item.product.name}`}
                                  >
                                    {updating === item.productId ? (
                                      <LoadingSpinner size="sm" />
                                    ) : (
                                      <Plus className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* 2. Quantity Controls (Mobile: Atas Kanan | Desktop: Tengah) */}
                        </div>


                        {/* 3. Subtotal & Trash Button (Mobile: Bawah Kanan | Desktop: Paling Kanan) */}
                        {/* col-span-2 membuat elemen ini pindah ke baris baru khusus saat di layar HP */}
                        <div className="col-span-2 mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 md:mt-0 md:justify-end md:border-none md:pt-0">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground md:text-[15px]">
                              <span className="mr-1.5 text-xs font-semibold text-slate-500">Subtotal</span>
                              <span className="font-extrabold text-[#071a4f]">{formatCurrency(item.product.price * item.qty)}</span>
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQty(item.productId, 0)}
                            disabled={updating === item.productId}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-red-100 bg-red-50 p-0 text-red-600 hover:border-red-200 hover:bg-red-100 hover:text-red-700 md:h-9 md:w-9"
                            aria-label={`Hapus ${item.product.name}`}
                          >
                            {updating === item.productId ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <GlassCard className="commerce-panel !rounded-lg !bg-white !p-5 !shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-[#e30613]" />
                <h2 className="font-extrabold text-[#071a4f]">Ringkasan belanja</h2>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-slate-500">Subtotal ({totalItems} item)</span>
                  <span>{formatCurrency(total - totalTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-500">
                  <span>Pajak</span>
                  <span>+{formatCurrency(totalTax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-extrabold">
                  <span>Total</span>
                  <span className="text-[#071a4f]">{formatCurrency(total)}</span>
                </div>
              </div>
            </GlassCard>
          </div>


          <div>
            <GlassCard className="commerce-panel sticky top-24 !rounded-lg !bg-white !p-5 !shadow-sm">
              <div className="mb-4">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-[#e30613]" />
                  <h3 className="font-extrabold text-[#071a4f]">Informasi pembeli</h3>
                </div>

                <div className="mb-4 grid grid-cols-2 rounded-md bg-slate-100 p-1" role="group" aria-label="Jenis pembeli">
                  <button
                    type="button"
                    onClick={() => setIsInternalCustomer(false)}
                    aria-pressed={!isInternalCustomer}
                    className={`h-9 rounded-sm px-2 text-xs font-bold transition ${!isInternalCustomer ? "bg-white text-[#071a4f] shadow-sm" : "text-slate-500"}`}
                  >
                    Pelanggan umum
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalCustomer(true)}
                    aria-pressed={isInternalCustomer}
                    className={`h-9 rounded-sm px-2 text-xs font-bold transition ${isInternalCustomer ? "bg-white text-[#071a4f] shadow-sm" : "text-slate-500"}`}
                  >
                    Karyawan internal
                  </button>
                </div>

                {isInternalCustomer && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="employee-code" className="mb-2 block text-xs font-bold text-slate-600">
                        Kode karyawan atau NIK
                      </Label>
                      <div className="relative">
                        <Input
                          id="employee-code"
                          placeholder="Masukkan kode atau NIK"
                          value={employeeCodeOrNIK}
                          onChange={handleEmployeeCodeChange}
                          disabled={isEmployeeValid === true}
                        />
                        {isValidatingEmployee && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <LoadingSpinner size="sm" />
                          </div>
                        )}
                      </div>
                      {isEmployeeValid === true && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Karyawan valid, cutoff tersedia
                        </p>
                      )}
                      {isEmployeeValid === false && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600">
                          <XCircle className="h-3.5 w-3.5" />
                          Data karyawan tidak valid
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {!isInternalCustomer && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="customer-nowa" className="mb-2 block text-xs font-bold text-slate-600">
                        Nomor WhatsApp
                      </Label>
                      <div className="relative">
                        <Input
                          id="customer-nowa"
                          placeholder="Contoh: 628123456789"
                          value={externalCustomer.nowa}
                          onChange={handleExternalNoWAChange}
                        />
                        {isValidatingExternal && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <LoadingSpinner size="sm" />
                          </div>
                        )}
                      </div>
                      {isExternalCustomerExists && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pelanggan sudah terdaftar
                        </p>
                      )}
                    </div>
                    {!isExternalCustomerExists && (
                        <div>
                          <Label htmlFor="customer-name" className="mb-2 block text-xs font-bold text-slate-600">
                            Nama pelanggan
                          </Label>
                          <Input
                            id="customer-name"
                            placeholder="Nama lengkap"
                            value={externalCustomer.name}
                            onChange={(e) => setExternalCustomer({ ...externalCustomer, name: e.target.value })}
                          />
                        </div>
                    )}
                    <div>
                      <Label htmlFor="customer-email" className="mb-2 block text-xs font-bold text-slate-600">
                        Email
                      </Label>
                      <Input
                        id="customer-email"
                        type="email"
                        placeholder="email@example.com"
                        value={externalCustomer.email}
                        onChange={(e) => setExternalCustomer({ ...externalCustomer, email: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="mb-4">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#e30613]" />
                  <h3 className="font-extrabold text-[#071a4f]">Metode pembayaran</h3>
                </div>
                {isDokuMode && !paymentSettingsQuery.error && <p className="mb-3 text-sm text-slate-600">Pilih metode DOKU sebelum membuat pesanan. Anda akan meninjau pilihan pembayaran pada langkah berikutnya.</p>}
                {paymentSettingsQuery.error ? (
                  <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
                    <p role="alert" className="text-sm text-red-800">Pengaturan pembayaran outlet belum dapat dimuat. Muat ulang sebelum melanjutkan.</p>
                    <Button type="button" size="sm" variant="outline" disabled={paymentSettingsQuery.isFetching} onClick={() => void paymentSettingsQuery.refetch()}>Muat ulang pembayaran</Button>
                  </div>
                ) : paymentSettingsQuery.isPending || loadingPaymentMethods ? (
                  <div className="space-y-2">
                    <div className="h-14 animate-pulse rounded-md bg-slate-100" />
                    <div className="h-14 animate-pulse rounded-md bg-slate-100" />
                  </div>
                ) : filteredPaymentMethods.length > 0 ? (
                  <RadioGroup
                    value={selectedPaymentMethod || ''}
                    onValueChange={setSelectedPaymentMethod}
                    disabled={paymentSettingsUnavailable}
                  >
                    <div className="space-y-2">
                      {filteredPaymentMethods.map((pm) => (
                        <div
                          key={pm.id}
                          className={`flex items-center space-x-3 rounded-md border p-3 transition ${paymentSettingsUnavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${selectedPaymentMethod === pm.id
                            ? 'border-[#071a4f] bg-[#eef2fb]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          onClick={() => { if (!paymentSettingsUnavailable) setSelectedPaymentMethod(pm.id); }}
                        >
                          <RadioGroupItem value={pm.id} id={pm.id} className="sr-only" />
                          <div className="flex items-center gap-3 flex-1">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${selectedPaymentMethod === pm.id ? "bg-[#071a4f] text-white" : "bg-slate-100 text-slate-600"}`}>
                              <PaymentMethodIcon paymentType={pm.payment_type} />
                            </span>
                            <div className="flex-1">
                              <Label
                                htmlFor={pm.id}
                                className="cursor-pointer font-extrabold"
                              >
                                {getPaymentMethodLabel(pm.payment_type)}
                              </Label>
                              {pm.payment_type === "DOKU" && <p className="mt-1 text-xs text-muted-foreground">Pesanan dibuat setelah Anda memilih metode dan mengonfirmasi pembayaran.</p>}
                              {pm.payment_type === 'transfer_rekening' && pm.bank_name && (
                                <p className="text-xs text-muted-foreground">
                                  {pm.bank_name} - {pm.account_number}
                                </p>
                              )}
                              {pm.payment_type === 'qris' && pm.account_name && (
                                <p className="text-xs text-muted-foreground">
                                  a.n. {pm.account_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada metode pembayaran yang tersedia
                  </p>
                )}
                {isDokuMode && !paymentSettings.doku_available && !paymentSettingsQuery.error && <p role="alert" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Pembayaran DOKU sementara tidak tersedia. Hubungi outlet atau coba kembali beberapa saat lagi.</p>}
                {isDokuMode && paymentSettings.doku_available && dokuMethods.length === 0 && !paymentSettingsQuery.error && <p role="alert" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Belum ada metode DOKU yang tersedia. Hubungi outlet atau coba kembali beberapa saat lagi.</p>}
              </div>

              <Separator className="my-4" />

              <div className="mb-5 flex items-center justify-between rounded-md bg-[#071a4f] px-4 py-3.5 text-white">
                <span className="text-sm font-bold text-white/75">Total pembayaran</span>
                <span className="text-xl font-extrabold">
                  {formatCurrency(total)}
                </span>
              </div>

              <div className="space-y-3">
                <Button
                  className="commerce-orange-button h-12 w-full rounded-md font-extrabold"
                  size="lg"
                  disabled={!selectedPaymentMethod || paymentSettingsUnavailable || paymentSettingsQuery.isFetching || isCreatingTransaction}
                  onClick={() => handleCreateTransaction()}
                >
                  {isCreatingTransaction ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Memproses...</span>
                    </>
                  ) : (
                    `Lanjutkan pembayaran`
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-md font-bold text-slate-600"
                  onClick={() => navigate("/commerce")}
                  disabled={isCreatingTransaction}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali belanja
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      <DokuMethodDialog
        open={dokuMethodDialogOpen}
        onOpenChange={(open) => { setDokuMethodDialogOpen(open); if (!open) setSelectedDokuMethod(null); }}
        methods={dokuMethods}
        selectedMethod={selectedDokuMethod}
        onSelectMethod={(method) => { setSelectedDokuMethod(method); setDokuSelectionError(""); }}
        amount={total}
        busy={isCreatingTransaction || paymentSettingsQuery.isFetching}
        unavailable={paymentSettingsUnavailable}
        error={dokuSelectionError}
        onConfirm={() => void handleCreateTransaction(dokuPickupAcknowledged, true)}
      />

      <Dialog open={pickupTimeAlert?.show || false} onOpenChange={() => setPickupTimeAlert(null)}>
        <DialogContent className="commerce-theme commerce-panel max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#071a4f]">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Waktu pengambilan
            </DialogTitle>
            <DialogDescription>
              Pesanan tetap dapat dibuat di luar jam pickup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-700" />
                <div>
                  <p className="text-sm font-extrabold text-amber-950">Jam pickup tersedia</p>
                  <p className="text-sm text-amber-800">
                    {pickupTimeAlert?.pickupStart} - {pickupTimeAlert?.pickupEnd}
                  </p>
                </div>
              </div>
              <p className="mt-3 border-t border-amber-200 pt-3 text-xs font-medium text-amber-900">{pickupTimeAlert?.message}</p>
            </div>
            <p className="text-sm text-slate-500">
              Pesanan akan menunggu sampai waktu pengambilan berikutnya tersedia.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-md font-bold" onClick={() => setPickupTimeAlert(null)}>
              Kembali
            </Button>
            <Button className="commerce-orange-button rounded-md font-extrabold" onClick={() => {
              setPickupTimeAlert(null);
              handleCreateTransaction(true);
            }}>
              Tetap Checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayoutCommerce>
  );
}
