import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft, MapPin, CreditCard, QrCode, Wallet, User, Mail, Phone } from "lucide-react";
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

export default function StoreCart() {
  const { locationCode } = useParams<{ locationCode: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState(getCartSummary());
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);

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

  // Update cart summary when storeData loads
  useEffect(() => {
    if (storeData) {
      const products = storeData.product_stores.map(p => ({
        id: p.id,
        name: p.master_product.product_name,
        price: p.base_price,
      }));
      setCart(getCartSummary(products));
    }
  }, [storeData]);

  // Update cart summary when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      if (storeData) {
        const products = storeData.product_stores.map(p => ({
          id: p.master_product.id,
          name: p.master_product.product_name,
          price: p.base_price,
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
    if (newQty < 0) return;

    setUpdating(productId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (newQty === 0) {
      removeFromCart(productId);
      toast.success("Produk dihapus dari keranjang");
    } else {
      updateCartQty(productId, newQty);
    }
    // Refresh cart after update
    if (storeData) {
      const products = storeData.product_stores.map(p => ({
        id: p.master_product.id,
        name: p.master_product.product_name,
        price: p.base_price,
      }));
      setCart(getCartSummary(products));
    }
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
          'Authorization': `Bearer ${localStorage.getItem('argopos.auth.token')}`
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
            <Link to={`${locationCode}/commerce`}>Belanja Sekarang</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
      <div className="max-w-6xl mx-auto px-4 py-2">
        {/* Header */}
        <div className="flex flex-col items-start gap-6 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${locationCode}/commerce`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali Belanja
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Keranjang Belanja</h1>
            {storeData && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />
                <span>{storeData.location_name} ({storeData.location_code})</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <GlassCard className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{item.product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.product.price)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQty(item.productId, item.qty - 1)}
                          disabled={updating === item.productId || item.qty <= 1}
                        >
                          {updating === item.productId ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.qty}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQty(item.productId, item.qty + 1)}
                          disabled={updating === item.productId}
                        >
                          {updating === item.productId ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(item.product.price * item.qty)}
                        </p>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateQty(item.productId, 0)}
                        disabled={updating === item.productId}
                        className="text-red-500 hover:text-red-600"
                      >
                        {updating === item.productId ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <GlassCard className="p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Ringkasan Belanja</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({totalItems} item)</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pajak</span>
                  <span className="text-green-600">Rp0</span>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Customer Information Form */}
              <div className="mb-4">
                <h3 className="font-medium mb-3">Informasi Customer</h3>
                
                {/* Customer Type Toggle */}
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="internal-customer"
                    checked={isInternalCustomer}
                    onCheckedChange={(checked) => setIsInternalCustomer(checked as boolean)}
                  />
                  <Label
                    htmlFor="internal-customer"
                    className="cursor-pointer"
                  >
                    Internal Employee Buyer
                  </Label>
                </div>

                {/* Internal Customer Form */}
                {isInternalCustomer && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="employee-code" className="text-sm mb-2 block">
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
                      <Label htmlFor="customer-nowa" className="text-sm mb-2 block">
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
                          <Label htmlFor="customer-name" className="text-sm mb-2 block">
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
                          <Label htmlFor="customer-email" className="text-sm mb-2 block">
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
                <h3 className="font-medium mb-3">Metode Pembayaran</h3>
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
                            className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                              selectedPaymentMethod === pm.id
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/50'
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
                                  className="font-medium cursor-pointer"
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

              <div className="flex justify-between items-center mb-6">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(total)}
                </span>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full"
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
                  className="w-full"
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
    </AppLayoutCommerce>
  );
}
