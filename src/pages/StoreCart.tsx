import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCartSummary, updateCartQty, removeFromCart, clearCart } from "@/lib/storefront";
import { formatCurrency } from "@/lib/mockData";
import { config } from "@/lib/config";
import { toast } from "sonner";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { CartItemSkeleton, CartSummarySkeleton, LoadingSpinner } from "@/components/shared/SkeletonLoader";

export default function StoreCart() {
  const [isLoading, setIsLoading] = useState(true);
  const { items, total, totalItems } = getCartSummary();
  const [cart, setCart] = useState(getCartSummary());
  const [updating, setUpdating] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce}>
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

  if (items.length === 0) {
    return (
      <AppLayoutCommerce title={config.appNameCommerce}>
        <div className="text-center py-20">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Keranjang Kosong</h2>
          <p className="text-muted-foreground mb-6">Belum ada produk di keranjang kamu</p>
          <Button asChild>
            <Link to="/commerce">Belanja Sekarang</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={config.appNameCommerce}>
      <div className="max-w-6xl mx-auto px-4 py-2">
        {/* Header */}
        <div className="flex flex-col items-start gap-6 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/commerce">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali Belanja
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Keranjang Belanja</h1>
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
                  <span>Biaya Pengiriman</span>
                  <span className="text-green-600">Gratis</span>
                </div>
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
                  onClick={() => window.location.href = "/commerce/checkout"}
                >
                  Checkout
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleClearCart}
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
