import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, QrCode, CreditCard, Wallet, MessageCircle, Copy, CheckCircle, Package, CheckCircle2, Phone } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { LoadingSpinner } from "@/components/shared/SkeletonLoader";
import { useQuery } from "@tanstack/react-query";
import { config } from "@/lib/config";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";
import { userService } from "@/lib/services/userService";
import { FaWhatsapp } from "react-icons/fa";
import { badgeOderStatus, getStatusBadgeKey } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface StoreData {
  location_id: string;
  location_name: string;
  location_code: string;
  assigned_users?: StoreAssignedUser[];
  payment_methods?: PaymentMethod[];
}

interface StoreAssignedUser {
  id: string;
  username: string;
  email: string;
  no_wa: string;
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
  master_location_id: string;
  customer_id: string;
  status: string;
  payment_code: string;
  payment_method_id: string;
  nominal_code: string;
  base_amount: number;
  total_amount: number;
  total_item: number;
  created_at: string;
  updated_at: string;
  transaction_code?: string;
  transaction_carts?: TransactionCart[];
  // Pickup proof fields
  path_proof_pickup?: string;
  pickup_at?: string;
}

export default function PaymentDetail() {
  const { locationCode, transactionId } = useParams<{ locationCode: string; transactionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60); // 2 hours in seconds
  const [codeTrx, setCodeTrx] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [confirmedReceipt, setConfirmedReceipt] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  // Fetch store data
  const { data: storeData, isLoading } = useQuery({
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

  // Fetch payment methods
  const { data: paymentMethods } = useQuery({
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

  // Fetch store assigned users (admin info)
  const { data: storeAssignedUsers } = useQuery({
    queryKey: ['storeAssignedUsers', storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return [];
      const endpoint = `${config.apiUrl}/api/v1/stores/${storeData.location_id}/assigned-users`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch store assigned users');
      }
      const result = await response.json();
      return result.data as StoreAssignedUser[];
    },
    enabled: !!storeData?.location_id,
  });

  // Fetch transaction data with polling every 5 seconds
  const { data: transactionData, error: transactionError } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const endpoint = `${config.apiUrl}/api/v1/transactions/${transactionId}`;
      console.log('Fetching transaction from:', endpoint);
      const response = await fetch(endpoint);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to fetch transaction:', errorData);
        throw new Error('Failed to fetch transaction data');
      }
      const result = await response.json();
      console.log('Transaction data:', result);
      return result.data as Transaction;
    },
    enabled: !!transactionId,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Set selected payment method from transaction data
  useEffect(() => {
    if (paymentMethods && transactionData?.payment_method_id) {
      const method = paymentMethods.find(pm => pm.id === transactionData.payment_method_id);
      setSelectedPaymentMethod(method || null);
    }
  }, [paymentMethods, transactionData]);

  // Set codeTrx from transaction data
  useEffect(() => {
    if (transactionData?.nominal_code) {
      setCodeTrx(transactionData.nominal_code);
    }
  }, [transactionData]);

  // Calculate time left based on transaction created_at
  useEffect(() => {
    if (!transactionData?.created_at) return;

    const createdAt = new Date(transactionData.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const maxSeconds = 2 * 60 * 60; // 2 hours

    const remainingSeconds = maxSeconds - diffSeconds;

    if (remainingSeconds <= 0) {
      // Auto reject transaction if > 2 hours
      setTimeLeft(0);
      // TODO: Call API to auto reject transaction
    } else {
      setTimeLeft(remainingSeconds);
    }
  }, [transactionData]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalWithCode = transactionData ? transactionData.total_amount : 0;

  const handleSendToWA = (user: StoreAssignedUser) => {
    if (!user.no_wa) {
      toast.error('Nomor WA tidak tersedia');
      return;
    }

    const message = encodeURIComponent(
      `Halo ${user.username},\n\nSaya ingin mengirim bukti pembayaran untuk order di ${storeData?.location_name} dengan transaction code: ${transactionData?.transaction_code}.\n\nTotal Pembayaran: ${formatCurrency(totalWithCode)}\nCode Trx: ${transactionData.payment_code}\n\nMohon verifikasi pembayaran saya. Terima kasih!`
    );

    const waNumber = user.no_wa.replace(/^0/, '62').replace(/\+/g, '');
    const waUrl = `https://wa.me/${waNumber}?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const handleConfirmReceipt = async () => {
    if (!transactionId) {
      toast.error('Transaction ID tidak ditemukan');
      return;
    }

    setIsConfirmingReceipt(true);

    try {
      console.log('Confirming receipt for transaction:', transactionId);
      const response = await fetch(`${config.apiUrl}/api/v1/transactions/${transactionId}/confirm-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Gagal mengkonfirmasi penerimaan barang');
      }

      const result = await response.json();
      console.log('Success response:', result);

      setConfirmedReceipt(true);
      toast.success('✅ Terima kasih! Konfirmasi penerimaan barang berhasil recorded');

      // Navigate after a short delay to show success
      setTimeout(() => {
        navigate(`/${locationCode}/commerce/payment-success/${transactionId}`);
      }, 1500);
    } catch (error) {
      console.error('Error in handleConfirmReceipt:', error);
      toast.error('Gagal mengkonfirmasi penerimaan barang');
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  const handleCopyCode = (key: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(prev => ({ ...prev, [key]: true }));
    toast.success(key + ' disalin!');
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
  };

  const handleDownload = (url) => {
    const anchor = document.createElement("a");

    const fileName = url.split("/").pop();

    anchor.href = url;
    anchor.download = fileName;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleMarkAsPaid = () => {
    // TODO: Implement API call to mark as paid
    toast.success('Pembayaran berhasil dikonfirmasi!');
    navigate(`/${locationCode}/commerce/payment-success`);
  };

  if (isLoading || !transactionData || !selectedPaymentMethod) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AppLayoutCommerce>
    );
  }

  if (transactionError) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
          <p className="text-red-500 mb-4">Gagal memuat data transaksi</p>
          <p className="text-muted-foreground mb-4 text-sm">{transactionError.message}</p>
          <Button asChild>
            <Link to={`/${locationCode}/commerce/cart`}>Kembali ke Keranjang</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  if (!storeData) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <p className="text-muted-foreground mb-4">Data store tidak ditemukan</p>
          <Button asChild>
            <Link to={`/${locationCode}/commerce/cart`}>Kembali ke Keranjang</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
      <div className="max-w-[1800px] mx-auto px-4 py-2">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start gap-4 mb-6">
          {/* <Button variant="outline" size="sm" asChild>
            <Link to={`/${locationCode}/commerce/cart`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Link>
          </Button> */}
          <h1 className="text-2xl font-bold">Detail Pembayaran</h1>
        </div>

        {/* Countdown */}
        {(transactionData.status === 'WAITING_TO_PAYMENT') && (
          <GlassCard className="p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Sisa waktu pembayaran</p>
                  <p className="text-2xl font-bold text-orange-500">{formatTime(timeLeft)}</p>
                </div>
              </div>
              <Badge variant={timeLeft > 1800 ? "default" : "destructive"}>
                {timeLeft > 1800 ? "Aktif" : "Segera Expired"}
              </Badge>
            </div>
          </GlassCard>
        )}

        {(transactionData.status === 'PAID') && (
          <GlassCard className="p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <span className="text-sm text-muted-foreground">Pembarayaran Telah Dikonfirmasi</span>
                </div>
              </div>
              <Badge variant="default">
                PAID
              </Badge>
            </div>
          </GlassCard>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Product List */}
          <GlassCard className="glass-card p-6 col-span-4">
            <h2 className="text-lg font-semibold mb-4">Daftar Produk</h2>
            <div className="space-y-4 text-sm md:text-lg">
              {transactionData?.transaction_carts && transactionData.transaction_carts.length > 0 ? (
                transactionData.transaction_carts.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    {item.product_details?.image_path ? (
                      <img
                        src={`${config.endpointUrl}/${item.product_details.image_path}`}
                        alt={item.product_details.product_name || 'Product'}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{item.product_details?.product_name || `Product #${item.product_stock_id}`}</h4>
                      <p className="text-sm text-muted-foreground">Qty: {item.qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.amount / item.qty)} / item</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Tidak ada item pesanan</p>
              )}
            </div>
          </GlassCard>

          {/* Payment Method Details */}
          <GlassCard className="p-6 col-span-4 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Metode Pembayaran</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-1">
                {selectedPaymentMethod.payment_type === 'qris' && (
                  <QrCode className="h-10 w-10 text-primary" />
                )}
                {selectedPaymentMethod.payment_type === 'transfer_rekening' && (
                  <CreditCard className="h-10 w-10 text-primary" />
                )}
                {selectedPaymentMethod.payment_type === 'cutoff_hutang' && (
                  <Wallet className="h-10 w-10 text-primary" />
                )}
                <div className="flex items-center">
                {selectedPaymentMethod.payment_type === 'qris' && <span className="font-medium">QRIS</span>}
                {selectedPaymentMethod.payment_type === 'transfer_rekening' && <span className="font-medium">Transfer Rekening</span>}
                {selectedPaymentMethod.payment_type === 'cutoff_hutang' && <span className="font-medium">Cutoff/Hutang</span>}
                {/* <div className="flex items-center gap-1">
                  Status: {transactionData.status === 'PAID' ? <Badge variant="secondary" className="text-green-700 font-bold">Dibayar</Badge> : <Badge variant="secondary">Menunggu Pembayaran</Badge>}
                </div> */}
              </div>
              </div>

              {selectedPaymentMethod.payment_type === 'transfer_rekening' && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank:</span>
                    <span className="font-medium">{selectedPaymentMethod.bank_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">No. Rekening:</span>
                    <span className="font-medium">{selectedPaymentMethod.account_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Atas Nama:</span>
                    <span className="font-medium">{selectedPaymentMethod.account_name}</span>
                  </div>
                </div>
              )}

              {selectedPaymentMethod.payment_type === 'qris' && (
                <div className="space-y-2 text-sm">
                  {selectedPaymentMethod.image_url && (
                    <div className="w-full bg-white rounded-lg p-4 flex flex-col items-center justify-center">
                      <img
                        src={`${config.endpointUrl}/public/${selectedPaymentMethod.image_url}`}
                        alt="QRIS"
                        className="w-full h-auto max-w-[20rem] object-contain"
                      />
                      <div className="mt-4">
                        <Button onClick={() => handleDownload(`${config.endpointUrl}/public/${selectedPaymentMethod.image_url}`)} variant="outline" className="w-full font-medium px-8 py-2 rounded-lg">
                          Download QRIS
                        </Button>
                      </div>
                    </div>
                  )}
                  {selectedPaymentMethod.account_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atas Nama:</span>
                      <span className="font-medium">{selectedPaymentMethod.account_name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Info for QRIS and Transfer Rekening
              {(selectedPaymentMethod.payment_type === 'qris' || selectedPaymentMethod.payment_type === 'transfer_rekening') && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                  <p className="text-sm font-medium">Hubungi Admin untuk Konfirmasi Pembayaran:</p>
                  {storeAssignedUsers && storeAssignedUsers.length > 0 ? (
                    <div className="space-y-2">
                      {storeAssignedUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-medium">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{user.username}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendToWA(user)}
                            disabled={!user.no_wa}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WA
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada admin tersedia</p>
                  )}
                </div>
              )} */}

              {selectedPaymentMethod.payment_type === 'cutoff_hutang' && (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Pembayaran via cutoff/hutang. Silakan konfirmasi penerimaan barang setelah barang diterima.
                  </p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Admin Contact - Show for staff users (<=1 assigned store) */}
          {storeAssignedUsers && storeAssignedUsers.length > 0 && (
            <GlassCard className="glass-card p-6 col-span-4 md:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Kontak Admin</h2>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Hubungi admin untuk konfirmasi pembayaran atau bantuan:</p>
                {storeAssignedUsers.map((user) => (
                  <div key={user.id} className="flex flex-row items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <p className="font-medium text-sm">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        {user.no_wa && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <FaWhatsapp className="h-3 w-3" />
                            <span>{user.no_wa}</span>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendToWA(user)}
                          disabled={!user.no_wa}
                          className="mt-1 max-w-[150px]"
                        >
                          <FaWhatsapp color="green" className="h-4 w-4" />
                          <span className="text-xs text-green-900">Kontak WA</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Payment Amount */}
          <GlassCard className="p-6 col-span-4">
            <h2 className="text-lg font-semibold mb-4">Detail Pembayaran</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm md:text-md">Order Status</span>
                <div className="flex items-center gap-0">
                  <StatusBadge status={getStatusBadgeKey(transactionData.status)} />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm md:text-md">Transaction Code</span>
                <div className="flex items-center gap-0">
                  <span className="font-bold text-xs text-primary">{transactionData.transaction_code}</span>
                  <Button variant="ghost" size="xs" onClick={() => handleCopyCode('transaction code', transactionData.transaction_code)}>
                    {copied['transaction code'] ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm md:text-md">Subtotal</span>
                <span className="font-semibold">{formatCurrency(transactionData?.base_amount || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm md:text-md">Nominal Code (Unik)</span>
                <div className="flex items-center gap-0">
                  <span className="font-semibold">{transactionData.payment_code}</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Pembayaran</span>
                <div className="flex items-center gap-0">
                  <span className="font-bold text-primary">{formatCurrency(totalWithCode)}</span>
                  <Button variant="ghost" size="xs" onClick={() => handleCopyCode('total harga', totalWithCode.toString())}>
                    {copied['total harga'] ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Show pickup proof status if available */}
            {transactionData.path_proof_pickup && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-800 text-sm">✅ Bukti Serah Terima Telah Diupload</p>
                    <p className="text-xs text-green-600 mt-1">
                      Diupload pada: {transactionData.pickup_at ? new Date(transactionData.pickup_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show confirmed state */}
            {confirmedReceipt && (
              <div className="mt-4 p-4 px-2 bg-green-100 rounded-lg border border-green-300 text-center">
                <div className="flex items-center justify-center gap-2 text-green-800 font-semibold">
                  <CheckCircle className="h-6 w-6" />
                  <span>Konfirmasi penerimaan barang berhasil!</span>
                </div>
              </div>
            )}

            {/* Show preparation message for PAID/PREPARING_PRODUCT status */}
            {(transactionData.status === 'PAID' || transactionData.status === 'PREPARING_PRODUCT') && (
              <div className="mt-4 p-4 px-2 bg-blue-50 rounded-lg border border-blue-200 text-center">
                <div className="flex items-center justify-center gap-2 text-blue-800">
                  <span className="text-xs font-medium">📦 Pesanan sedang dalam preparation. Mohon tunggu.</span>
                </div>
              </div>
            )}

            {/* Show pickup proof image if available */}
            {transactionData.path_proof_pickup && (transactionData.status === 'READY_TO_PICKUP' || transactionData.status === 'PAID') && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Bukti Serah Terima:</p>
                <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                  {transactionData.path_proof_pickup ? (
                    <img
                      src={`${config.endpointUrl}/${transactionData.path_proof_pickup}`}
                      alt="Bukti Serah Terima"
                      className="w-full h-auto max-h-64 object-contain"
                    />
                  ) : (
                    <img
                      src={`${config.endpointUrl}/${transactionData.path_proof_pickup}`}
                      alt="Bukti Serah Terima"
                      className="w-full h-auto max-h-64 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  )}
                  <div className="hidden p-4 text-center text-sm text-muted-foreground">
                    Bukti serah terima tersedia
                  </div>
                </div>
              </div>
            )}

            {/* Show waiting message if pickup proof not yet uploaded by admin */}
            {transactionData.status === 'READY_TO_PICKUP' && !transactionData.path_proof_pickup && (
              <div className="mt-4 p-4 px-2 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-800">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  <span className="text-sm font-medium">Menunggu admin mengupload bukti serah terima...</span>
                </div>
              </div>
            )}

            {/* Show PAID status message - encouraging direct confirmation */}
            {transactionData.status === 'PAID' && !confirmedReceipt && (
              <div className="mt-4 p-4 px-2 bg-green-50 rounded-lg border border-green-200 text-center">
                <div className="flex items-center justify-center gap-2 text-green-800">
                  <span className="text-xs font-medium">💰 Pembayaran telah dikonfirmasi.</span>
                </div>
              </div>
            )}

            {/* {selectedPaymentMethod.payment_type !== 'cutoff_hutang' && transactionData.status === 'WAITING_TO_PAYMENT' && (
              <Button className="w-full mt-4" onClick={handleMarkAsPaid}>
                Konfirmasi Pembayaran
              </Button>
            )} */}

            {/* Show confirm receipt button - Customer confirms pickup themselves after seeing proof */}
            {(transactionData.status === 'READY_TO_PICKUP') && !confirmedReceipt && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <p className="text-xs text-gray-800 font-medium">
                    👆 Silakan konfirmasi pengambilan barang di bawah setelah Anda menerima barang
                  </p>
                </div>
                <Button
                  className="w-full bg-primary hover:bg-primary text-white text-sm font-semibold py-3"
                  onClick={handleConfirmReceipt}
                  disabled={isConfirmingReceipt}
                >
                  {isConfirmingReceipt ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Konfirmasi Barang Sudah Diterima
                    </>
                  )}
                </Button>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Assigned Users */}
        {storeData.assigned_users && storeData.assigned_users.length > 0 && (
          <GlassCard className="p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Admin Toko</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeData.assigned_users.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendToWA(user)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WA
                  </Button>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppLayoutCommerce>
  );
}
