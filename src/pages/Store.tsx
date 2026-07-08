import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BadgePercent,
  Check,
  Clock,
  Gift,
  MapPin,
  Package,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  StoreIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import CardProduct from "@/components/shared/CardProduct";
import { Button } from "@/components/ui/button";
import { ProductCardSkeleton } from "@/components/shared/SkeletonLoader";
import { addToCart, getCartSummary, removeFromCart } from "@/lib/storefront";
import { toast } from "sonner";
import { config } from "@/lib/config";
import { locationService } from "@/lib/services/locationService";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/mockData";

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

function resolveImageUrl(path?: string, fallback?: string) {
  const raw = path || fallback || "";
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  return `${config.endpointUrl}/${raw.replace(/^\/+/, "")}`;
}

function getDiscountPercentage(product: ProductStock) {
  if (!product.discount_price || product.discount_price >= product.base_price || product.base_price <= 0) {
    return 0;
  }

  return Math.round(((product.base_price - product.discount_price) / product.base_price) * 100);
}

function calculateFinalPrice(product: ProductStock, forceBase = false) {
  const price = !forceBase && product.discount_price > 0 ? product.discount_price : product.base_price;
  const tax = price * ((product.tax_percentage || 0) / 100);
  return Math.round(price + tax);
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Gift;
  value: string;
  label: string;
  tone: "blue" | "orange";
}) {
  return (
    <div className="commerce-panel-soft relative min-h-[132px] overflow-hidden p-5 md:min-h-[156px]">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#fff0d7] md:h-28 md:w-28" />
      <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${tone === "blue" ? "bg-secondary text-primary" : "bg-[#fff0d7] text-[#ff7a00]"}`}>
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <p className="text-3xl font-extrabold leading-none text-foreground">{value}</p>
      <p className="mt-2 text-sm font-extrabold text-muted-foreground">{label}</p>
    </div>
  );
}

export default function Store() {
  const [search, setSearch] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyReadyStock, setOnlyReadyStock] = useState(false);
  const [sortMode, setSortMode] = useState<"popular" | "discount" | "newest" | "price-low">("popular");
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

  const { data: storeList, isLoading: storesLoading } = useQuery({
    queryKey: ["stores"],
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

  const { data: storeData, error, isLoading: storeDataLoading } = useQuery({
    queryKey: ["store", selectedLocationCode],
    queryFn: async () => {
      const endpoint = `${config.apiUrl}/api/v1/${selectedLocationCode}/store`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch store data");
      }
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: !!selectedLocationCode,
  });

  const { data: operationalStatus } = useQuery({
    queryKey: ["operationalStatus", storeData?.location_id],
    queryFn: async () => {
      if (!storeData?.location_id) return null;
      const response = await apiClient.getOperationalStatus(storeData.location_id);
      if (!response.success || !response.data) {
        return null;
      }
      return response.data as OperationalStatus;
    },
    enabled: !!storeData?.location_id,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!storeData || storeDataLoading) return;
    setStoreInfo({
      storeName: storeData.location_name,
      openTime: operationalStatus?.store_open_time || storeData.time_open_store || "08:00",
      closeTime: operationalStatus?.store_close_time || storeData.time_close_store || "20:00",
      pickupStart: operationalStatus?.pickup_start_time || storeData.time_start_pickup || "09:00",
      pickupEnd: operationalStatus?.pickup_end_time || storeData.time_end_pickup || "18:00",
      message: operationalStatus?.message || "Toko sedang tutup",
    });
    if (operationalStatus && !operationalStatus.is_open) {
      setStoreClosedModal(true);
    }
  }, [operationalStatus, storeData, storeDataLoading]);

  useEffect(() => {
    if (storeData) {
      const products = storeData.product_stores.map((p) => ({
        id: p.master_product.id,
        name: p.master_product.product_name,
        price: p.base_price,
      }));
      setCartSummary(getCartSummary(products));
    }
  }, [storeData]);

  useEffect(() => {
    const handleStorageChange = () => {
      setCartSummary(getCartSummary());
    };

    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [storeData]);

  const products = storeData?.product_stores ?? [];
  const { items, total, totalItems } = cartSummary;
  const categories = Array.from(
    new Set(products.map((product) => product.master_product.category).filter(Boolean))
  ) as string[];

  const filtered = products
    .filter((product) => {
      const productName = product.master_product?.product_name?.toLowerCase() || "";
      const productCategory = product.master_product?.category || "";
      const matchesSearch = productName.includes(search.toLowerCase());
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(productCategory);
      const matchesDiscount = !onlyDiscount || getDiscountPercentage(product) > 0;
      const matchesReady = !onlyReadyStock || product.stock > 0;

      return matchesSearch && matchesCategory && matchesDiscount && matchesReady;
    })
    .sort((a, b) => {
      if (sortMode === "discount") return getDiscountPercentage(b) - getDiscountPercentage(a);
      if (sortMode === "price-low") return calculateFinalPrice(a) - calculateFinalPrice(b);
      return 0;
    });

  const featuredProduct = products.find((product) => product.stock > 0) || products[0];
  const featuredImage = featuredProduct
    ? resolveImageUrl(featuredProduct.master_product.image_path, featuredProduct.master_product.image_url)
    : "";
  const readyProductCount = products.filter((product) => product.stock > 0).length;
  const maxDiscount = products.reduce((max, product) => Math.max(max, getDiscountPercentage(product)), 0);
  const activeOutletCount = storeList?.length || 0;
  const cartDiscount = items.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product || getDiscountPercentage(product) === 0) return sum;
    return sum + Math.max(calculateFinalPrice(product, true) - calculateFinalPrice(product), 0) * item.qty;
  }, 0);
  const subtotalBeforeDiscount = total + cartDiscount;
  const cartUrl = selectedLocationCode ? `/${selectedLocationCode}/commerce/cart` : "/commerce/cart";

  const handleClearCart = () => {
    if (items.length > 0) {
      items.forEach((item) => removeFromCart(item.product.id));
      toast.success("Keranjang dikosongkan");
      window.dispatchEvent(new Event("storage"));
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
    if (operationalStatus && !operationalStatus.is_open) {
      setStoreInfo({
        storeName: storeData?.location_name || "Toko",
        openTime: operationalStatus.store_open_time || storeData?.time_open_store || "08:00",
        closeTime: operationalStatus.store_close_time || storeData?.time_close_store || "20:00",
        pickupStart: operationalStatus.pickup_start_time || storeData?.time_start_pickup || "09:00",
        pickupEnd: operationalStatus.pickup_end_time || storeData?.time_end_pickup || "18:00",
        message: operationalStatus.message || "Toko sedang tutup. Tidak dapat menambahkan barang.",
      });
      setStoreClosedModal(true);
      return;
    }

    const cartItem = getCartSummary().items.find(
      (item) => item.product.id === productId
    );
    const currentQty = cartItem?.qty || 0;

    if (currentQty >= productStock) {
      toast.error("Stok tidak mencukupi");
      return;
    }

    const result = addToCart(productId, 1, {
      name: productName,
      price: productPrice,
      imageUrl: productImageUrl,
      tax_percentage: tax_percentage,
    }, productStock);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    setTimeout(() => {
      setCartSummary(getCartSummary());
      window.dispatchEvent(new Event("storage"));
    }, 0);

    toast.success(`${productName} ditambahkan ke keranjang`);
  };

  const handleStoreChange = (locationCode: string) => {
    setSelectedLocationCode(locationCode);
    setSearch("");
    setSelectedCategories([]);
    setOnlyDiscount(false);
    setOnlyReadyStock(false);
  };

  const openModalInfoStore = () => {
    setStoreClosedModal(true);
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setOnlyDiscount(false);
    setOnlyReadyStock(false);
    setSortMode("popular");
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  };

  return (
    <AppLayoutCommerce
      title={storeData?.location_name || config.appNameCommerce}
      locationCode={selectedLocationCode}
      openModalInfo={openModalInfoStore}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari chicken pokpok, nugget, sosis, bakso..."
    >
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="commerce-hero-card relative min-h-[230px] overflow-hidden rounded-[1.75rem] px-6 py-7 text-white shadow-2xl shadow-primary/20 md:min-h-[332px] md:px-8 md:py-10"
          >
            <div className="relative z-10 max-w-[69%] md:max-w-[64%]">
              <div className="mb-5 inline-flex rounded-full border border-white/22 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#fff5d7]">
                Promo Frozen Food
              </div>
              <h1 className="text-[1.72rem] font-extrabold leading-[0.98] tracking-normal md:text-5xl">
                Stok fresh untuk kebutuhan outlet hari ini.
              </h1>
              <p className="mt-5 max-w-xl text-sm font-medium leading-relaxed text-white/76 md:text-lg">
                Belanja lebih cepat dengan katalog siap order, stok real-time, promo aktif, dan checkout yang jelas untuk user internal.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  className="commerce-orange-button h-12 rounded-2xl px-5 text-base font-extrabold"
                  onClick={() => document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Belanja Sekarang
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-white/20 bg-white/12 px-5 text-base font-extrabold text-white hover:bg-white/20 hover:text-white"
                  onClick={() => {
                    setOnlyDiscount(true);
                    document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Lihat Promo
                </Button>
              </div>
            </div>

            <div className="absolute -right-5 bottom-0 flex h-[82%] w-[44%] items-end justify-center md:right-4 md:h-[90%] md:w-[38%]">
              {featuredImage ? (
                <img
                  src={featuredImage}
                  alt={featuredProduct?.master_product.product_name || "Produk frozen food"}
                  className="commerce-hero-product max-h-full w-full object-contain"
                />
              ) : (
                <Package className="mb-12 h-28 w-28 text-white/40" />
              )}
            </div>
            <div className="absolute right-[31%] top-[15%] h-0 w-0 rotate-90 border-b-[14px] border-l-[10px] border-r-[10px] border-b-[#ff7a00] border-l-transparent border-r-transparent" />
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={ShoppingBag} value={readyProductCount.toString()} label="Produk ready stock" tone="blue" />
            <StatCard icon={BadgePercent} value={`${maxDiscount}%`} label="Diskon tertinggi" tone="orange" />
            <StatCard icon={MapPin} value={activeOutletCount.toString()} label="Outlet aktif" tone="orange" />
            <StatCard icon={Check} value="4.8" label="Rata-rata rating" tone="blue" />
          </div>
        </section>

        <div className="commerce-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 md:mx-0 md:px-0">
          {storesLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 w-36 shrink-0 animate-pulse rounded-full bg-muted" />
            ))
          ) : (
            storeList?.map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => handleStoreChange(store.location_code)}
                className={`commerce-pill shrink-0 ${selectedLocationCode === store.location_code ? "commerce-pill-active" : ""}`}
              >
                <StoreIcon className="h-4 w-4" />
                {store.location_name}
              </button>
            ))
          )}
        </div>

        <div className="commerce-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 lg:hidden">
          <button type="button" className="commerce-pill h-9 shrink-0 px-4" onClick={resetFilters}>
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
          <button
            type="button"
            className={`commerce-pill h-9 shrink-0 px-4 ${onlyDiscount ? "commerce-pill-active" : ""}`}
            onClick={() => setOnlyDiscount((value) => !value)}
          >
            Promo
          </button>
          <button
            type="button"
            className={`commerce-pill h-9 shrink-0 px-4 ${onlyReadyStock ? "commerce-pill-active" : ""}`}
            onClick={() => setOnlyReadyStock((value) => !value)}
          >
            Ready Stock
          </button>
          <button
            type="button"
            className={`commerce-pill h-9 shrink-0 px-4 ${sortMode === "discount" ? "commerce-pill-active" : ""}`}
            onClick={() => setSortMode(sortMode === "discount" ? "popular" : "discount")}
          >
            Terlaris
          </button>
        </div>

        {operationalStatus?.is_open === false && (
          <div className="commerce-panel-soft sticky top-[104px] z-30 flex items-center justify-between gap-3 border-orange-200 bg-orange-50 px-4 py-3 text-orange-900 md:top-[96px]">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-orange-600" />
              <div className="text-sm">
                <p className="font-bold">
                  Toko Sedang Tutup. Buka pada jam {storeInfo?.openTime?.substring(0, 5)} - {storeInfo?.closeTime?.substring(0, 5)}
                </p>
              </div>
            </div>
          </div>
        )}

        <section id="store-products" className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_310px]">
          <aside className="hidden lg:block">
            <div className="commerce-panel-soft sticky top-28 p-5">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-base font-extrabold">Filter Produk</h2>
                <button type="button" className="text-xs font-extrabold text-[#ff7a00]" onClick={resetFilters}>
                  Reset
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-extrabold">Kategori</h3>
                  <div className="space-y-3">
                    {(categories.length > 0 ? categories : ["Frozen Food"]).map((category) => (
                      <label key={category} className="flex cursor-pointer items-center gap-3 text-sm font-bold text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <h3 className="mb-3 text-sm font-extrabold">Promo</h3>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={onlyDiscount}
                        onChange={() => setOnlyDiscount((value) => !value)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      Diskon aktif
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={onlyReadyStock}
                        onChange={() => setOnlyReadyStock((value) => !value)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      Ready stock
                    </label>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <h3 className="mb-3 text-sm font-extrabold">Range Harga</h3>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-[#ff7a00] to-[#ffd23f]" />
                  </div>
                  <div className="mt-3 flex justify-between text-xs font-extrabold text-muted-foreground">
                    <span>Rp 25k</span>
                    <span>Rp 50k</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Produk rekomendasi</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Menampilkan {filtered.length} produk dari outlet {storeData?.location_name || "-"}
                </p>
              </div>

              <div className="commerce-scrollbar flex gap-2 overflow-x-auto">
                {[
                  { key: "popular", label: "Semua" },
                  { key: "discount", label: "Diskon" },
                  { key: "newest", label: "Terbaru" },
                  { key: "price-low", label: "Harga Terendah" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSortMode(item.key as typeof sortMode);
                      if (item.key === "discount") setOnlyDiscount(true);
                      if (item.key === "popular") resetFilters();
                    }}
                    className={`commerce-pill h-9 shrink-0 px-4 text-xs ${sortMode === item.key ? "commerce-pill-active" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {storeDataLoading || (!storeData && !error && selectedLocationCode) ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            ) : error ? (
              <div className="commerce-panel flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
                <Package className="mb-4 h-16 w-16 text-muted-foreground" />
                <h2 className="mb-2 text-2xl font-extrabold">Error Loading Products</h2>
                <p className="mb-4 text-muted-foreground">
                  Failed to load products for this store.
                </p>
                <Button onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 pb-10 md:grid-cols-3 xl:grid-cols-4">
                {filtered.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    whileHover={operationalStatus?.is_open !== false ? { y: -4 } : {}}
                    className="commerce-panel-soft group cursor-pointer overflow-hidden p-0 transition-transform"
                  >
                    <CardProduct
                      product={{
                        id: product.id,
                        name: product.master_product.product_name,
                        price: product.base_price,
                        image_url: resolveImageUrl(product.master_product.image_path, product.master_product.image_url),
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
            ) : (
              <div className="commerce-panel flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
                <ShoppingBag className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="font-bold text-muted-foreground">Produk tidak ditemukan</p>
              </div>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="commerce-panel sticky top-28 overflow-hidden p-0">
              <div className="bg-primary p-5 text-white">
                <h2 className="text-lg font-extrabold">Keranjang Belanja</h2>
                <p className="mt-1 text-sm font-medium text-white/70">
                  Checkout cepat untuk order internal. Item bisa diubah langsung dari katalog.
                </p>
              </div>

              <div className="space-y-4 p-5">
                {items.length === 0 ? (
                  <div className="py-8 text-center">
                    <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-bold text-muted-foreground">Keranjang masih kosong</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.slice(0, 4).map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 border-b border-border pb-3 last:border-b-0">
                        <div className="commerce-product-visual h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                          <img src={item.product.image_url || ""} alt={item.product.name} className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-extrabold">{item.product.name}</p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {item.qty} x {formatCurrency(item.product.price)}
                          </p>
                        </div>
                        <p className="text-sm font-extrabold text-green-600">{formatCurrency(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex justify-between text-sm font-bold text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotalBeforeDiscount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-green-600">
                      <span>Diskon</span>
                      <span>- {formatCurrency(cartDiscount)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-extrabold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <Button asChild className="commerce-orange-button h-14 w-full rounded-2xl text-base font-extrabold">
                      <Link to={cartUrl}>Checkout Sekarang</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-50 rounded-2xl bg-primary p-3 text-white shadow-2xl shadow-primary/30 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{totalItems} item · {formatCurrency(total)}</p>
              <p className="truncate text-xs font-medium text-white/70">Siap checkout dari {storeData?.location_name || "outlet"}</p>
            </div>
            <Button asChild className="commerce-orange-button h-12 shrink-0 rounded-2xl px-5 text-base font-extrabold">
              <Link to={cartUrl}>Checkout</Link>
            </Button>
          </div>
        </div>
      )}

      <Dialog open={storeClosedModal} onOpenChange={setStoreClosedModal}>
        <DialogContent className="commerce-panel max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              {operationalStatus && !operationalStatus.is_open ? "Toko Sedang Tutup" : "Toko Sedang Buka"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="mb-2 text-lg font-extrabold">{storeInfo?.storeName}</p>
              <p className="text-muted-foreground">{operationalStatus && !operationalStatus.is_open ? storeInfo?.message : "Toko sedang buka. Silahkan berbelanja."}</p>
            </div>

            <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-extrabold">Jam Operasional</p>
                  <p className="text-sm text-muted-foreground">
                    {storeInfo?.openTime?.substring(0, 5)} - {storeInfo?.closeTime?.substring(0, 5)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-extrabold">Waktu Pengambilan</p>
                  <p className="text-sm text-muted-foreground">
                    {storeInfo?.pickupStart?.substring(0, 5)} - {storeInfo?.pickupEnd?.substring(0, 5)}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold">Note: Pembelian barang melewati jam {storeInfo?.pickupEnd?.substring(0, 5)}, bisa diambil besok.</p>
                </div>
              </div>
            </div>

            {operationalStatus && !operationalStatus.is_open && (
              <p className="text-center text-sm text-muted-foreground">
                Silakan kembali saat jam operasional toko.
              </p>
            )}
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
