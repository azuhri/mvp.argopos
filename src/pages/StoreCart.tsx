import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { getCartSummary, updateCartQty, removeFromCart, clearCart } from "@/lib/storefront";
import { formatCurrency } from "@/lib/mockData";
import { config } from "@/lib/config";
import { toast } from "sonner";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";

export default function StoreCart() {
  const { items, total, totalItems } = getCartSummary();
  const [cart, setCart] = useState(getCartSummary());
  const [updating, setUpdating] = useState<string | null>(null);

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
    setUpdating(null);
  };
  const refreshCart = () => {
    setCart(getCartSummary());
  };

  const handleClearCart = () => {
    clearCart();
    refreshCart();
    toast.success("Keranjang dikosongkan");
  };

  if (items.length === 0) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce}>
        <div className="text-center py-20">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Keranjang Kosong</h2>
          <p className="text-muted-foreground mb-6">Belum ada produk di keranjang kamu</p>
          <Button asChild>
            <Link to="/store">Belanja Sekarang</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={config.appNameCommerce}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Keranjang ({totalItems} item)</h2>
            <Button variant="outline" size="sm" onClick={handleClearCart}>
              <Trash2 className="h-4 w-4 mr-1" />
              Kosongkan
            </Button>
          </div>

          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.productId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card p-4"
              >
                <div className="flex gap-4">
                  <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center flex-shrink-0">
                    <img src={item.product.image_url} alt={item.product.name} className="h-16 w-16 object-cover" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-medium">{item.product.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.product.category}</p>
                      <p className="text-sm font-semibold text-primary">
                        {formatCurrency(item.product.price)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === item.productId}
                          onClick={() => handleUpdateQty(item.productId, item.qty - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {updating === item.productId ? "..." : item.qty}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === item.productId}
                          onClick={() => handleUpdateQty(item.productId, item.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatCurrency(item.subtotal)}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleUpdateQty(item.productId, 0)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <GlassCard className="sticky top-20">
            <h3 className="font-semibold mb-4">Ringkasan Pesanan</h3>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal ({totalItems} item)</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Ongkos Kirim</span>
                <span>Gratis</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button className="w-full btn-tap">
                Checkout
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/store">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Lanjut Belanja
                </Link>
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppLayoutCommerce>
  );
}
