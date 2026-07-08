import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ShoppingBag, Home, ArrowLeft, Package } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { config } from "@/lib/config";
import { formatCurrency } from "@/lib/mockData";
import { useQuery } from "@tanstack/react-query";

interface TransactionCart {
  product_stock_id: string;
  amount: number;
  qty: number;
  product_details?: {
    product_name: string;
    image_path: string;
  };
}

interface TransactionData {
  id: string;
  transaction_code: string;
  status: string;
  nominal_code: string;
  base_amount: number;
  total_amount: number;
  total_item: number;
  customer_name: string;
  transaction_carts: TransactionCart[];
}

export default function PaymentSuccess() {
  const { locationCode, transactionId } = useParams<{ locationCode: string; transactionId: string }>();

  // Fetch transaction data
  const { data: transactionData, isLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const response = await fetch(`${config.apiUrl}/api/v1/transactions/${transactionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transaction data');
      }
      const result = await response.json();
      return result.data as TransactionData;
    },
    enabled: !!transactionId,
  });

  return (
    <AppLayoutCommerce title={config.appNameCommerce} locationCode={locationCode || ''}>
      <div className="mx-auto max-w-2xl px-2 py-10 md:py-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <GlassCard className="!rounded-[1.5rem] !bg-card p-6 text-center shadow-2xl shadow-primary/10 md:p-8">
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-green-100"
              >
                <CheckCircle className="h-10 w-10 text-green-600" />
              </motion.div>

              {/* Success Message */}
              <h1 className="mb-2 text-3xl font-extrabold tracking-tight">Transaksi Selesai!</h1>
              <p className="mb-4 text-sm font-medium text-muted-foreground">
                Pembayaran Anda telah diverifikasi. Admin toko telah memberikan barang pesanan Anda.
              </p>

              {/* Transaction Code */}
              {transactionData && (
                <div className="mb-6">
                  <div className="rounded-2xl bg-muted/50 p-4">
                    <p className="mb-1 text-sm font-semibold text-muted-foreground">Transaction Code</p>
                    <p className="font-mono text-xl font-extrabold text-primary">{transactionData.transaction_code || '-'}</p>
                  </div>
                </div>
              )}

              {/* Product List */}
              {transactionData && transactionData.transaction_carts && transactionData.transaction_carts.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-4 text-left text-lg font-extrabold">Item Pesanan</h3>
                  <div className="space-y-3">
                    {transactionData.transaction_carts.map((item, index) => (
                      <div key={index} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-3">
                        {item.product_details?.image_path ? (
                          <img
                            src={`${config.endpointUrl}/${item.product_details.image_path}`}
                            alt={item.product_details.product_name || 'Product'}
                            className="commerce-product-visual h-16 w-16 rounded-2xl object-contain p-1"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <h4 className="text-sm font-extrabold">{item.product_details?.product_name || `Product #${item.product_stock_id}`}</h4>
                          <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-green-600">{formatCurrency(item.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Subtotal:</span>
                      <span className="font-bold">{formatCurrency(transactionData.base_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Nominal Code:</span>
                      <span className="font-bold text-primary">{transactionData.payment_code}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold">Total Pembayaran:</span>
                      <span className="text-lg font-extrabold">{formatCurrency(transactionData.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}

            {/* Order Status */}
            <div className="mb-8 rounded-2xl bg-muted/50 p-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span className="font-extrabold">Terimakasih Telah Berbelanja</span>
              </div>
              {/* <div className="text-sm text-muted-foreground">
                <p className="mb-2">Sedang dipersiapkan oleh admin toko</p>
                <p className="text-xs">Anda akan menerima notifikasi ketika barang siap diambil</p>
              </div> */}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button className="commerce-orange-button h-12 w-full rounded-2xl font-extrabold" size="lg" asChild>
                <Link to={`/commerce`}>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Belanja Lagi
                </Link>
              </Button>
              {/* <Button variant="outline" className="w-full" size="lg" asChild>
                <Link to={`/${locationCode}/commerce/cart`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Lihat Pesanan Lain
                </Link>
              </Button> */}
            </div>
          </GlassCard>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            <p>Jika ada pertanyaan, silakan hubungi admin toko melalui WhatsApp</p>
          </motion.div>
        </motion.div>
        )}
      </div>
    </AppLayoutCommerce>
  );
}
