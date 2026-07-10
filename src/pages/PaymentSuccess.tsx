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
      const response = await fetch(`${config.apiUrl}//transactions/${transactionId}`);
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
      <div className="max-w-2xl mx-auto px-4 py-16">
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
            <GlassCard className="p-8 text-center">
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="h-10 w-10 text-green-600" />
              </motion.div>

              {/* Success Message */}
              <h1 className="text-3xl font-bold mb-2">Transaksi Selesai!</h1>
              <p className="text-muted-foreground text-sm mb-4">
                Pembayaran Anda telah diverifikasi. Admin toko telah memberikan barang pesanan Anda.
              </p>

              {/* Transaction Code */}
              {transactionData && (
                <div className="mb-6">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Transaction Code</p>
                    <p className="font-mono text-xl font-bold text-primary">{transactionData.transaction_code || '-'}</p>
                  </div>
                </div>
              )}

              {/* Product List */}
              {transactionData && transactionData.transaction_carts && transactionData.transaction_carts.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 text-left">Item Pesanan</h3>
                  <div className="space-y-3">
                    {transactionData.transaction_carts.map((item, index) => (
                      <div key={index} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
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
                        <div className="flex-1 text-left">
                          <h4 className="font-medium text-sm">{item.product_details?.product_name || `Product #${item.product_stock_id}`}</h4>
                          <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(item.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(transactionData.base_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Nominal Code:</span>
                      <span className="font-medium text-primary">{transactionData.payment_code}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Pembayaran:</span>
                      <span className="font-bold text-lg">{formatCurrency(transactionData.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}

            {/* Order Status */}
            <div className="bg-muted/50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span className="font-medium">Terimakasih Telah Berbelanja</span>
              </div>
              {/* <div className="text-sm text-muted-foreground">
                <p className="mb-2">Sedang dipersiapkan oleh admin toko</p>
                <p className="text-xs">Anda akan menerima notifikasi ketika barang siap diambil</p>
              </div> */}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button className="w-full" size="lg" asChild>
                <Link to={`/commerce`}>
                  <ShoppingBag className="h-4 w-4 mr-2" />
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
