import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft, MapPin, CreditCard, QrCode, Wallet, User, Mail, Phone, Clock, AlertCircle } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { getCartSummary, updateCartQty, removeFromCart, clearCart } from "@/lib/storefront";
import { formatCurrency } from "@/lib/mockData";
import { config } from "@/lib/config";
import { toast } from "sonner";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { CartItemSkeleton, CartSummarySkeleton, LoadingSpinner } from "@/components/shared/SkeletonLoader";
import { useQuery } from "@tanstack/react-query";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { calculateFinalPrice } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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

export default function StoreCart() {
  const { locationCode } = useParams<{ locationCode: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState(getCartSummary());
  const [totalTax, setTotalTax] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [pickupTimeAlert, setPickupTimeAlert] = useState<{
    show: boolean;
    message: string;
    pickupStart: string;
    pickupEnd: string;
  } | null>(null);
  const [skipPickupTimeCheck, setSkipPickupTimeCheck] = useState(false);

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
  const { data: storeData, error } = useQuery({
    queryKey: ['store', locationCode],
    queryFn: async () => {
      const endpoint = `${config.apiUrl}/api/v1/${locationCode}/store`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch store data');
      }
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: !!locationCode,
  });

  // Fetch payment methods for the store
  const { data: paymentMethods, isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ['paymentMethods', storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return [];
      const endpoint = `${config.apiUrl}/api/v1/stores/${storeData.location_id}/payment-methods`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }
      const result = await response.json();
      return result.data as PaymentMethod[];
    },
    enabled: !!storeData?.location_id,
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
        id: p.master_product.id,
        name: p.master_product.product_name,
        price: p.base_price,
        stock: p.stock,
      }));
      setCart(getCartSummary(products));
      setTotalTax(
        getCartSummary(products).items.reduce(
          (acc, item) =>
            acc + ((item.productPrice - (item.productPrice / (1 + (item.tax_percentage / 100)))) * item.qty),
          0
        )
      );
    }
  }, [storeData]);


  const findProductByid = (productId: string) => {
    return storeData?.product_stores.find(p => p.id === productId);
  }

  // Update cart summary when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      if (storeData) {
        const products = storeData.product_stores.map(p => ({
          id: p.master_product.id,
          name: p.master_product.product_name,
          price: p.base_price,
          stock: p.stock,
        }));
        setCart(getCartSummary(products));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [storeData]);

  const { items, total, totalItems } = cart;

  // Simulate cart loading
  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(loadingTimer);
  }, []);

  const handleUpdateQty = async (productId: string, newQty: number) => {
    const product = findProductByid(productId);

    if (newQty < 0) return;

    setUpdating(productId);
    await new Promise((resolve) => setTimeout(resolve, 300));

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
        id: p.master_product.id,
        name: p.master_product.product_name,
        price: p.base_price,
      }));
      setCart(getCartSummary(products));
    }
  };

  const handleClearCart = () => {
    clearCart();
    refreshCart();
    toast.success("Keranjang dikosongkan");
  };

  // Debounce implementation
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Validate employee code or NIK
  const validateEmployee = async (code: string) => {
    if (!code.trim()) {
      setIsEmployeeValid(null);
      return;
    }

    setIsValidatingEmployee(true);

    try {
      const response = await fetch(`${config.apiUrl}/api/v1/users/check-valid-employee`, {
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
    } catch (error) {
      setIsEmployeeValid(false);
    } finally {
      setIsValidatingEmployee(false);
    }
  };

  // Debounced validation
  const validateEmployeeDebounced = useCallback(debounce(validateEmployee, 800), []);

  // Handle employee code/NIK input change
  const handleEmployeeCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmployeeCodeOrNIK(value);
    validateEmployeeDebounced(value);
  };

  // Validate external customer by no_wa
  const validateExternalCustomer = async (no_wa: string) => {
    if (!no_wa.trim()) {
      setIsExternalCustomerExists(false);
      return;
    }

    setIsValidatingExternal(true);

    try {
      const response = await fetch(`${config.apiUrl}/api/v1/transactions/check-customer-by-no-wa`, {
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
    } catch (error) {
      setIsExternalCustomerExists(false);
    } finally {
      setIsValidatingExternal(false);
    }
  };

  // Debounced validation for external customer
  const validateExternalCustomerDebounced = useCallback(debounce(validateExternalCustomer, 800), []);

  // Handle external customer no_wa input change
  const handleExternalNoWAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setExternalCustomer(prev => ({ ...prev, nowa: value }));
    validateExternalCustomerDebounced(value);
  };

  // Create transaction
  const handleCreateTransaction = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Pilih metode pembayaran terlebih dahulu');
      return;
    }

    // Check if within pickup window (skip if user already acknowledged)
    if (operationalStatus && !operationalStatus.is_within_pickup_window && !skipPickupTimeCheck) {
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
      // Only require name and email if customer doesn't exist
      if (!isExternalCustomerExists) {
        if (!externalCustomer.name.trim() || !externalCustomer.email.trim()) {
          toast.error('Nama dan email harus diisi untuk customer baru');
          return;
        }
      }
    }

    setIsCreatingTransaction(true);

    try {
      // Prepare cart items
      const carts = cart.items.map(item => ({
        product_stock_id: item.productId,
        amount: item.product.price * item.qty,
        qty: item.qty
      }));

      // Generate nominal code (random 2 digit)
      const nominalCode = Math.floor(10 + Math.random() * 90).toString();

      // Prepare transaction request
      const transactionRequest: any = {
        master_location_id: storeData.location_id,
        base_amount: cart.total,
        total_item: cart.totalItems,
        payment_method_id: selectedPaymentMethod,
        nominal_code: nominalCode,
        carts: carts
      };

      // Add customer information based on type
      if (isInternalCustomer) {
        transactionRequest.customer_name = employeeCodeOrNIK.trim();
        transactionRequest.employee_code = employeeCodeOrNIK.trim();
      } else {
        transactionRequest.customer_name = externalCustomer.name.trim();
        transactionRequest.no_wa = externalCustomer.nowa.trim();
      }

      // Create transaction via API
      const response = await fetch(`${config.apiUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionRequest)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Transaksi berhasil dibuat');
        clearCart();
        navigate(`/${locationCode}/commerce/payment/${result.data.id}`);
      } else {
        toast.error('Gagal membuat transaksi');
      }
    } catch (error) {
      toast.error('Gagal membuat transaksi');
    } finally {
      setIsCreatingTransaction(false);
    }
  };

  // Filter payment methods based on customer type
  const filteredPaymentMethods = paymentMethods?.filter(pm => {
    if (!pm.is_active) return false;
    // Cutoff/hutang only available for internal customers who are validated
    if (pm.payment_type === 'cutoff_hutang' && (!isInternalCustomer || isEmployeeValid !== true)) return false;
    return true;
  }) || [];

  // Reset employee validation when switching customer type
  useEffect(() => {
    setIsEmployeeValid(null);
    setEmployeeCodeOrNIK('');
  }, [isInternalCustomer]);

  if (isLoading) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-24 h-10 bg-muted/50 rounded-md animate-pulse" />
            <div className="w-48 h-8 bg-muted/50 rounded-md animate-pulse" />
            <div className="w-16 h-6 bg-muted/50 rounded-md animate-pulse ml-auto" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart items skeleton */}
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CartItemSkeleton key={i} />
              ))}
            </div>

            {/* Cart summary skeleton */}
            <div className="lg:col-span-1">
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
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Store Not Found</h2>
          <p className="text-muted-foreground mb-6">Unable to load store data</p>
          <Button asChild>
            <Link to="/commerce">Back to Commerce</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  if (items.length === 0) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="text-center py-20">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Keranjang Kosong</h2>
          <p className="text-muted-foreground mb-6">Belum ada produk di keranjang kamu</p>
          <Button asChild>
            <Link to={`/commerce`}>Belanja Sekarang</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        {/* Header */}
        <div className="commerce-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
          <Button variant="outline" size="sm" asChild className="rounded-2xl font-extrabold">
            <Link to={`/commerce`}>
              <ArrowLeft className="h-4 w-4" />
              Kembali Belanja
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Keranjang Belanja</h1>
            {storeData && (
              <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{storeData.location_name} ({storeData.location_code})</span>
              </div>
            )}
          </div>
          </div>
          <div className="rounded-2xl bg-primary px-5 py-4 text-white">
            <p className="text-sm font-semibold text-white/70">Total keranjang</p>
            <p className="text-2xl font-extrabold">{formatCurrency(total)}</p>
            <p className="text-xs font-medium text-white/65">{totalItems} item siap checkout</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div
                    key={item.productId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <GlassCard className="my-3 !rounded-[1.25rem] !bg-card p-4 shadow-lg shadow-primary/5 transition-all md:p-5">
                      {/* Container Utama: CSS Grid di Mobile, Flex Row di Desktop */}
                      <div className="grid grid-cols-[1fr_auto] md:flex md:flex-row md:items-center md:justify-between gap-3 md:gap-4">

                        {/* 1. Product Image & Info (Mobile: Atas Kiri | Desktop: Paling Kiri) */}
                        <div className="flex flex-col">
                          <div className="flex items-start gap-3 md:gap-4 min-w-0">
                            <div className="commerce-product-visual relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-border md:h-28 md:w-28">
                              {/* Skeleton - always behind image during loading */}
                              {(!imageLoaded[item.productId] && !imageError[item.productId]) && (
                                <div className="absolute inset-0 z-10 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700 animate-pulse" />
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
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                                  <svg className="w-5 h-5 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 pt-0.5 md:pt-0">
                              <h3 className="mb-1 truncate text-sm font-extrabold leading-tight text-foreground md:text-base md:whitespace-normal">
                                {item.product.name}
                              </h3>
                              <p className="text-xs font-bold text-green-600 md:text-sm">
                                {formatCurrency(item.product.price)}
                              </p>
                              <p className="text-xs font-semibold text-muted-foreground md:text-sm">
                                <span className="text-xs">Available Stock: {findProductByid(item.productId)?.stock}</span>
                              </p>
                              <div className="flex mt-2 items-start md:items-center">
                                <div className="flex items-center gap-1 rounded-2xl border border-primary/15 bg-secondary p-1 shadow-sm">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-xl p-0 text-primary hover:bg-primary/10 md:h-8 md:w-8"
                                    onClick={() => handleUpdateQty(item.productId, item.qty - 1)}
                                    disabled={updating === item.productId || item.qty <= 1}
                                  >
                                    {updating === item.productId ? (
                                      <LoadingSpinner size="sm" />
                                    ) : (
                                      <Minus className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <span className="w-6 text-center text-sm font-extrabold text-primary md:w-8">
                                    {item.qty}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-xl p-0 text-primary hover:bg-primary/10 md:h-8 md:w-8"
                                    onClick={() => handleUpdateQty(item.productId, item.qty + 1)}
                                    disabled={updating === item.productId || (item.product?.stock !== undefined && item.qty >= item.product.stock)}
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
                        <div className="col-span-2 mt-2 flex items-center justify-end gap-3 border-t border-border pt-3 md:mt-0 md:border-none md:pt-0">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground md:text-[15px]">
                              <span className="mr-1.5 text-xs font-semibold text-muted-foreground">Subtotal:</span>
                              <span className="font-extrabold text-foreground">{formatCurrency(item.product.price * item.qty)}</span>
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQty(item.productId, 0)}
                            disabled={updating === item.productId}
                            className="h-8 w-8 md:h-9 md:w-9 p-0 flex items-center justify-center rounded-xl border-red-100 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 hover:border-red-200 transition-colors shrink-0"
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
            <GlassCard className="!rounded-[1.25rem] !bg-card">
              <h2 className="mb-4 text-lg font-extrabold">Ringkasan Belanja</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Subtotal <span className="text-xs font-medium italic">({totalItems} items without tax)</span></span>
                  <span>{formatCurrency(total - totalTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-red-500">
                  <span>Tax</span>
                  <span>+{formatCurrency(totalTax)}</span>
                </div>
                <div className="flex justify-between text-lg font-extrabold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </GlassCard>
          </div>


          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <GlassCard className="sticky top-28 !rounded-[1.25rem] !bg-card p-5 shadow-xl shadow-primary/5">
              {/* <Separator className="my-4" /> */}

              {/* Customer Information Form */}
              <div className="mb-4">
                <h3 className="mb-3 text-lg font-extrabold">Informasi Customer</h3>

                {/* Customer Type Toggle */}
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="internal-customer"
                    checked={isInternalCustomer}
                    onCheckedChange={(checked) => setIsInternalCustomer(checked as boolean)}
                  />
                  <Label
                    htmlFor="internal-customer"
                    className="cursor-pointer font-bold"
                  >
                    Internal Employee Buyer
                  </Label>
                </div>

                {/* Internal Customer Form */}
                {isInternalCustomer && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="employee-code" className="mb-2 block text-sm font-bold">
                        Employee Code / NIK
                      </Label>
                      <div className="relative">
                        <Input
                          id="employee-code"
                          placeholder="Masukkan Employee Code atau NIK"
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
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Employee valid - Cutoff/Hutang tersedia
                        </p>
                      )}
                      {isEmployeeValid === false && (
                        <p className="text-xs text-red-600 mt-1">
                          ✗ Employee tidak valid
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* External Customer Form */}
                {!isInternalCustomer && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="customer-nowa" className="mb-2 block text-sm font-bold">
                        No WhatsApp
                      </Label>
                      <div className="relative">
                        <Input
                          id="customer-nowa"
                          placeholder="628123456789"
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
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Customer terdaftar sebelumnya
                        </p>
                      )}
                    </div>
                    {!isExternalCustomerExists && (
                      <>
                        <div>
                          <Label htmlFor="customer-name" className="mb-2 block text-sm font-bold">
                            Nama Customer
                          </Label>
                          <Input
                            id="customer-name"
                            placeholder="Nama lengkap"
                            value={externalCustomer.name}
                            onChange={(e) => setExternalCustomer({ ...externalCustomer, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer-email" className="mb-2 block text-sm font-bold">
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
                      </>
                    )}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Payment Method Selection */}
              <div className="mb-4">
                <h3 className="mb-3 text-lg font-extrabold">Metode Pembayaran</h3>
                {loadingPaymentMethods ? (
                  <div className="space-y-2">
                    <div className="h-12 bg-muted/50 rounded-md animate-pulse" />
                    <div className="h-12 bg-muted/50 rounded-md animate-pulse" />
                  </div>
                ) : filteredPaymentMethods.length > 0 ? (
                  <RadioGroup
                    value={selectedPaymentMethod || ''}
                    onValueChange={setSelectedPaymentMethod}
                  >
                    <div className="space-y-2">
                      {filteredPaymentMethods.map((pm) => (
                        <div
                          key={pm.id}
                          className={`flex cursor-pointer items-center space-x-3 rounded-2xl border-2 p-3 transition-all ${selectedPaymentMethod === pm.id
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                            : 'border-border bg-card hover:border-primary/30'
                            }`}
                          onClick={() => setSelectedPaymentMethod(pm.id)}
                        >
                          <RadioGroupItem value={pm.id} id={pm.id} className="sr-only" />
                          <div className="flex items-center gap-3 flex-1">
                            {pm.payment_type === 'qris' && (
                              <QrCode className="h-5 w-5 text-primary" />
                            )}
                            {pm.payment_type === 'transfer_rekening' && (
                              <CreditCard className="h-5 w-5 text-primary" />
                            )}
                            {pm.payment_type === 'cutoff_hutang' && (
                              <Wallet className="h-5 w-5 text-primary" />
                            )}
                            <div className="flex-1">
                              <Label
                                htmlFor={pm.id}
                                className="cursor-pointer font-extrabold"
                              >
                                {pm.payment_type === 'qris' && 'QRIS'}
                                {pm.payment_type === 'transfer_rekening' && 'Transfer Rekening'}
                                {pm.payment_type === 'cutoff_hutang' && 'Cutoff/Hutang'}
                              </Label>
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
              </div>

              <Separator className="my-4" />

              <div className="mb-6 flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-white">
                <span className="font-extrabold">Total</span>
                <span className="text-xl font-extrabold">
                  {formatCurrency(total)}
                </span>
              </div>

              <div className="space-y-3">
                <Button
                  className="commerce-orange-button h-12 w-full rounded-2xl font-extrabold"
                  size="lg"
                  disabled={!selectedPaymentMethod || isCreatingTransaction}
                  onClick={handleCreateTransaction}
                >
                  {isCreatingTransaction ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Memproses...</span>
                    </>
                  ) : (
                    `Checkout di ${storeData.location_name}`
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl font-extrabold"
                  onClick={handleClearCart}
                  disabled={isCreatingTransaction}
                >
                  Kosongkan Keranjang
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Pickup Time Alert Modal */}
      <Dialog open={pickupTimeAlert?.show || false} onOpenChange={() => setPickupTimeAlert(null)}>
        <DialogContent className="commerce-panel max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Informasi Waktu Pengambilan
            </DialogTitle>
            <DialogDescription>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-2xl bg-muted/50 p-4">

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-extrabold">Waktu Pengambilan Tersedia</p>
                  <p className="text-sm text-muted-foreground">
                    {pickupTimeAlert?.pickupStart} - {pickupTimeAlert?.pickupEnd}
                  </p>
                </div>
              </div>
              <hr className="my-2" />
              <p className="mt-1 text-center text-[10px] font-mono font-semibold">Note: {pickupTimeAlert?.message}</p>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Pesanan Anda tetap dapat dibuat dan akan menunggu hingga waktu pengambilan tersedia.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="my-2 rounded-2xl font-extrabold" onClick={() => {
                setPickupTimeAlert(null);
                setSkipPickupTimeCheck(false);
              }}>
              Tutup
            </Button>
            <Button className="commerce-orange-button rounded-2xl font-extrabold" onClick={() => {
              setSkipPickupTimeCheck(true);
              handleCreateTransaction();
            }}>
              Tetap Checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayoutCommerce>
  );
}
