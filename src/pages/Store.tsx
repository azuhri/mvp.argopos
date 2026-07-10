import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingBag, Package, StoreIcon, Clock, AlertCircle, X } from "lucide-react";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import CardProduct from "@/components/shared/CardProduct";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCardSkeleton, LoadingSpinner, Skeleton } from "@/components/shared/SkeletonLoader";
import { addToCart, getCartSummary, removeFromCart } from "@/lib/storefront";
import { toast } from "sonner";
import { config } from "@/lib/config";
import { locationService } from "@/lib/services/locationService";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/lib/services/productService";
import { Stock } from "@/lib/api";
import { Item } from "@radix-ui/react-dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { set } from "date-fns";

interface ProductStock {
  id: string;
  stock: number;
  base_price: number;
  discount_price: number;
  final_price: number;
  tax_percentage?: number;
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
  time_open_store?: string;
  time_close_store?: string;
  time_start_pickup?: string;
  time_end_pickup?: string;
}

interface Location {
  id: string;
  location_code: string;
  location_name: string;
  type: string;
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

export default function Store() {
  const [search, setSearch] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [cartSummary, setCartSummary] = useState(() => getCartSummary([]));
  const [storeClosedModal, setStoreClosedModal] = useState(false);
  const [storeInfo, setStoreInfo] = useState<{
    storeName: string;
    openTime: string;
    closeTime: string;
    pickupStart: string;
    pickupEnd: string;
    message: string;
  } | null>(null);

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
      const endpoint = `${config.apiUrl}/${selectedLocationCode}/store`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch store data');
      }
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: !!selectedLocationCode,
  });

  // Fetch operational status when storeData is loaded
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

  // Check if store is open and show modal if closed
  useEffect(() => {
    if (!storeData || storeDataLoading) return;
    if (storeData) {
      setStoreInfo({
        storeName: storeData.location_name,
        openTime: operationalStatus?.store_open_time || storeData.time_open_store || '08:00',
        closeTime: operationalStatus?.store_close_time || storeData.time_close_store || '20:00',
        pickupStart: operationalStatus?.pickup_start_time || storeData.time_start_pickup || '09:00',
        pickupEnd: operationalStatus?.pickup_end_time || storeData.time_end_pickup || '18:00',
        message: operationalStatus?.message || 'Toko sedang tutup',
      });
      if(operationalStatus && !operationalStatus.is_open) {
        setStoreClosedModal(true);
      }
    }
  }, [operationalStatus, storeData, storeDataLoading]);

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
    tax_percentage: number,
  ) => {
    // Check if store is closed
    if (operationalStatus && !operationalStatus.is_open) {
      setStoreInfo({
        storeName: storeData?.location_name || 'Toko',
        openTime: operationalStatus.store_open_time || storeData?.time_open_store || '08:00',
        closeTime: operationalStatus.store_close_time || storeData?.time_close_store || '20:00',
        pickupStart: operationalStatus.pickup_start_time || storeData?.time_start_pickup || '09:00',
        pickupEnd: operationalStatus.pickup_end_time || storeData?.time_end_pickup || '18:00',
        message: operationalStatus.message || 'Toko sedang tutup. Tidak dapat menambahkan barang.',
      });
      setStoreClosedModal(true);
      return;
    }

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
      tax_percentage: tax_percentage,
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

 const openModalInfoStore = () => {
  setStoreClosedModal(true)
 }

  return (
    <AppLayoutCommerce title={storeData?.location_name || config.appNameCommerce} locationCode={selectedLocationCode} openModalInfo={openModalInfoStore}>
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
        <div className="space-y-4">
          {/* Closed Store Banner */}
          {operationalStatus?.is_open === false && (
            <div className="sticky top-0 z-30 bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-4 py-3 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Toko Sedang Tutup. Buka pada jam <span className="font-bold text-destructive">{storeInfo?.openTime?.substring(0, 5)} - {storeInfo?.closeTime?.substring(0, 5)}</span>
                  </p>
                </div>
              </div>
              {/* <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-200 flex-shrink-0"
                onClick={() => setStoreClosedModal(true)}
              >
                Info
              </Button> */}
            </div>
          )}

          {/* Products Grid - Always show products */}
          <div className="grid grid-cols-2 pb-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={operationalStatus?.is_open !== false ? { y: -4, scale: 1.02 } : {}}
                className="glass-card-hover overflow-hidden cursor-pointer group"
              >
                <CardProduct
                  product={{
                    id: product.id,
                    name: product.master_product.product_name,
                    price: product.base_price,
                    image_url: config.endpointUrl + "/" + product.master_product.image_path,
                    stock: product.stock,
                    category: product.master_product.category || "",
                    discount_price: product.discount_price,
                    tax_percentage: product.tax_percentage || 0,
                    unit: "pack",
                    product_stock_id: product.id
                  }}
                  urlDetail={`/${selectedLocationCode}/commerce/product/${product.id}`}
                  handleAddToCart={handleAddToCart}
                  disabled={operationalStatus?.is_open === false}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!storeDataLoading && !error && filtered.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Produk tidak ditemukan</p>
        </div>
      )}

      {/* Store Closed Modal - Backdrop that can be closed */}
      <Dialog open={storeClosedModal} onOpenChange={setStoreClosedModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              {operationalStatus && !operationalStatus.is_open ? "Toko Sedang Tutup" : "Toko Sedang Buka"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">{storeInfo?.storeName}</p>
              <p className="text-muted-foreground">{operationalStatus && !operationalStatus.is_open ? storeInfo?.message : "Toko sedang buka. Silahkan berbelanja."}</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Jam Operasional</p>
                  <p className="text-sm text-muted-foreground">
                    {storeInfo?.openTime?.substring(0, 5)} - {storeInfo?.closeTime?.substring(0, 5)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Waktu Pengambilan</p>
                  <p className="text-sm text-muted-foreground">
                    {storeInfo?.pickupStart?.substring(0, 5)} - {storeInfo?.pickupEnd?.substring(0, 5)}
                  </p>
                  <p className="mt-1 text-[10px] font-mono font-semibold">Note: Pembelian barang melewati jam: {storeInfo?.pickupEnd?.substring(0, 5)}, bisa diambil besok.</p>
                </div>
              </div>
            </div>
            
            {operationalStatus && !operationalStatus.is_open &&
            <p className="text-sm text-center text-muted-foreground">
              Silakan kembali saat jam operasional toko.
            </p>}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setStoreClosedModal(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayoutCommerce>
  );
}
