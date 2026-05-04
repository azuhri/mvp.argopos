import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import CardProduct from "@/components/shared/CardProduct";
import { Button } from "@/components/ui/button";
import { Loader2, Package, ArrowLeft, ShoppingCart, Search, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProductCardSkeleton, LoadingSpinner, Skeleton } from "@/components/shared/SkeletonLoader";
import { addToCart, getCartSummary } from "@/lib/storefront";
import { toast } from "sonner";
import { config } from "@/lib/config";
import { log } from "console";

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
}

export default function CommerceCatalog() {
  const { locationCode } = useParams<{ locationCode: string }>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartSummary, setCartSummary] = useState(() => getCartSummary([]));
  const [isLoading, setIsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

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

  // Update cart summary when storeData loads
  useEffect(() => {
    if (storeData) {
      const products = storeData.product_stores.map(p => ({
        id: p.master_product.id,
        name: p.master_product.product_name,
        price: p.base_price,
      }));
      setCartSummary(getCartSummary(products));
    }
  }, [storeData]);

  // Simulate initial loading
  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
      setProductsLoading(false);
    }, 1500);

    return () => clearTimeout(loadingTimer);
  }, []);

  // Update cart summary when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      // Call getCartSummary without products parameter to use stored product details
      setCartSummary(getCartSummary());
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [storeData]);

  // Extract categories from products
  const products = storeData?.product_stores ?? [];

  const filtered = products.filter((p) => {
    return (
      p.master_product?.product_name
        ?.toLowerCase()
        .includes(search.toLowerCase()) || false
    );
  });

  const { items, total, totalItems } = cartSummary;

  const handleAddToCart = (
    productId: string,
    productName: string,
    productPrice: number,
    productImageUrl: string,
    productStockId: string,
  ) => {
    addToCart(productId, 1, {
      name: productName,
      price: productPrice,
      imageUrl: productImageUrl,
    });
    setTimeout(() => {
      setCartSummary(getCartSummary());
    }, 0);
    console.log('cart',getCartSummary());
    
    toast.success(`${productName} ditambahkan ke keranjang`);
  };



  if (error || !storeData) {
    return (
      <AppLayoutCommerce title="Store Not Found" locationCode={locationCode}>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Store Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The store you're looking for doesn't exist or is not available.
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </AppLayoutCommerce>
    );
  }

  return (
    <AppLayoutCommerce title={storeData.location_name} locationCode={locationCode}>
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
        {/* <div className="flex gap-1.5 overflow-x-auto pb-1">
          {isLoading ? (
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
        </div> */}
      </div>

      {/* Product Grid */}
      {productsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="glass-card-hover overflow-hidden cursor-pointer group"
            >
              <CardProduct
                product={{
                  id: product.id,
                  name: product.master_product.product_name,
                  price: product.base_price,
                  image_url: product.master_product.image_url,
                  stock: product.stock,
                  category: product.master_product.category || "",
                  discount_price: product.discount_price,
                  unit: "pack",
                  product_stock_id: product.id
                }}
                urlDetail={`/${locationCode}/commerce/product/${product.id}`}
                handleAddToCart={handleAddToCart}
              />
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
