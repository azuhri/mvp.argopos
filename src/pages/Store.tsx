import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingBag, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockProducts } from "@/lib/mockData";
import { addToCart, getCartSummary, removeFromCart, updateCartQty, clearCart } from "@/lib/storefront";
import { toast } from "sonner";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { config } from "@/lib/config";
import CardProduct from "@/components/shared/CardProduct";
import { ProductCardSkeleton, LoadingSpinner, Skeleton } from "@/components/shared/SkeletonLoader";

export default function Store() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartSummary, setCartSummary] = useState(getCartSummary());
  const [updating, setUpdating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  // Simulate initial loading
  useEffect(() => {
    // Simulate API loading delay
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
      setProductsLoading(false);
    }, 1500);

    return () => clearTimeout(loadingTimer);
  }, []);

  // Update cart summary when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setCartSummary(getCartSummary());
    };

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);

    // Also update on interval for same-tab updates
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const categories = ["all", ...Array.from(new Set(mockProducts.map((p) => p.category)))];
  const filtered = mockProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const { items, total, totalItems } = cartSummary;

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

  const handleAddToCart = (productId: string, productName: string) => {
    addToCart(productId);
    setCartSummary(getCartSummary()); // Trigger re-render
    toast.success(`${productName} ditambahkan ke keranjang`);
  };

  const handleClearCart = () => {
    clearCart();
    setCartSummary(getCartSummary()); // Trigger re-render
    toast.success("Keranjang dikosongkan");
  };

  return (
    <AppLayoutCommerce title={config.appNameCommerce}>
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          {isLoading ? (
            <Skeleton variant="text" className="w-full h-8" />
          ) : (
            <>
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card/70 backdrop-blur border-border/50"
              />
            </>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {isLoading ? (
            // Category filter skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-20 h-8 bg-muted/50 rounded-md animate-pulse" />
            ))
          ) : (
            categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="btn-tap capitalize text-xs px-2.5 whitespace-nowrap"
              >
                {cat}
              </Button>
            ))
          )}
        </div>
      </div>

      {/* Product Grid */}
      {productsLoading ? (
        // Product card skeletons
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {filtered.map((product, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="glass-card-hover overflow-hidden cursor-pointer group"
            >
              <CardProduct product={product} handleAddToCart={handleAddToCart} />
            </motion.div>
          ))}
        </div>
      )}

      {!productsLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Produk tidak ditemukan</p>
        </div>
      )}
    </AppLayoutCommerce>
  );
}
