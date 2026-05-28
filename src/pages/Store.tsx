import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingBag, Package, StoreIcon } from "lucide-react";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import CardProduct from "@/components/shared/CardProduct";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCardSkeleton, LoadingSpinner, Skeleton } from "@/components/shared/SkeletonLoader";
import { addToCart, getCartSummary, removeFromCart } from "@/lib/storefront";
import { toast } from "sonner";
import { config } from "@/lib/config";
import { locationService } from "@/lib/services/locationService";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/lib/services/productService";
import { Stock } from "@/lib/api";
import { Item } from "@radix-ui/react-dropdown-menu";

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

interface Location {
  id: string;
  location_code: string;
  location_name: string;
  type: string;
}

export default function Store() {
  const [search, setSearch] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [cartSummary, setCartSummary] = useState(() => getCartSummary([]));

  // Fetch list of stores
  const { data: storeList, isLoading: storesLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const listStores = await locationService.getListStore();
      return listStores as Location[];
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem("selectedLocationCode");
    if (saved) {
      setSelectedLocationCode(saved);
    }
  }, []);

  // Initialize with first store when store list loads
  useEffect(() => {
    const saved = localStorage.getItem("selectedLocationCode");
    if (storeList && storeList.length > 0 && !selectedLocationCode) {
      setSelectedLocationCode(saved ?? storeList[0].location_code);
    }
  }, [storeList, selectedLocationCode]);

  useEffect(() => {
    const saved = localStorage.getItem("selectedLocationCode");
    if (selectedLocationCode && selectedLocationCode !== saved) {
      handleClearCart();
    }
    if (selectedLocationCode) {
      localStorage.setItem("selectedLocationCode", selectedLocationCode);
    }
  }, [selectedLocationCode]);

  // Fetch store data by locationCode
  const { data: storeData, error, isLoading: storeDataLoading } = useQuery({
    queryKey: ['store', selectedLocationCode],
    queryFn: async () => {
      const endpoint = `${config.apiUrl}/api/v1/${selectedLocationCode}/store`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch store data');
      }
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: !!selectedLocationCode,
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

  // Update cart summary when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setCartSummary(getCartSummary());
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [storeData]);

  // Extract products from store data
  const products = storeData?.product_stores ?? [];

  // Filter products by search
  const filtered = products.filter((p) => {
    return (
      p.master_product?.product_name
        ?.toLowerCase()
        .includes(search.toLowerCase()) || false
    );
  });

  const { items } = cartSummary;

  const handleClearCart = () => {
    if (items.length > 0) {
      items.forEach(item => removeFromCart(item.product.id));
      toast.success("Keranjang dikosongkan");
    }
  };

  const handleAddToCart = (
    productId: string,
    productName: string,
    productPrice: number,
    productImageUrl: string,
    productStockId: string,
    productStock: number,
  ) => {

    // cari item di cart
    const cartItem = getCartSummary().items.find(
      (item) => item.product.id === productId
    );

    // qty sekarang di cart
    const currentQty = cartItem?.qty || 0;

    // cek stok
    if (currentQty >= productStock) {
      toast.error("Stok tidak mencukupi");
      return;
    }

    addToCart(productId, 1, {
      name: productName,
      price: productPrice,
      imageUrl: productImageUrl,
    });

    setTimeout(() => {
      setCartSummary(getCartSummary());
    }, 0);

    toast.success(`${productName} ditambahkan ke keranjang`);
  };

  const handleStoreChange = (locationCode: string) => {
    setSelectedLocationCode(locationCode);
    setSearch("");
  };

  return (
    <AppLayoutCommerce title={storeData?.location_name || config.appNameCommerce} locationCode={selectedLocationCode}>
      {/* Search & Filter */}
      <div className="flex flex-col gap-3 mb-3">
        <div className="relative flex-1">
          {storesLoading ? (
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
        <div className="flex gap-1.5 overflow-x-auto pb-4 sm:pb-0">
          {storesLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-20 h-8 bg-muted/50 rounded-md animate-pulse" />
            ))
          ) : (
            storeList?.map((store) => (
              <Button
                key={store.id}
                variant={selectedLocationCode === store.location_code ? "default" : "outline"}
                size="sm"
                onClick={() => handleStoreChange(store.location_code)}
                className="btn-tap uppercase text-xs px-2.5 whitespace-nowrap"
              >
                <StoreIcon size={16} />
                {store.location_name}
              </Button>
            ))
          )}
        </div>
      </div>

      {/* Product Grid */}
      {storeDataLoading || (!storeData && !error && selectedLocationCode) ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Error Loading Products</h2>
          <p className="text-muted-foreground mb-4">
            Failed to load products for this store.
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
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
                  image_url: config.apiUrl + "/" + product.master_product.image_path,
                  stock: product.stock,
                  category: product.master_product.category || "",
                  discount_price: product.discount_price,
                  unit: "pack",
                  product_stock_id: product.id
                }}
                urlDetail={`/${selectedLocationCode}/commerce/product/${product.id}`}
                handleAddToCart={handleAddToCart}
              />
            </motion.div>
          ))}
        </div>
      )}

      {!storeDataLoading && !error && filtered.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Produk tidak ditemukan</p>
        </div>
      )}
    </AppLayoutCommerce>
  );
}
