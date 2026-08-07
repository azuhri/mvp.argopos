import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BadgePercent,
  Boxes,
  Clock,
  MapPin,
  Package,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Snowflake,
  StoreIcon,
  Tag,
  type LucideIcon,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/mockData";
import { PendingPaymentSection } from "@/components/commerce/PendingPaymentSection";

const STORE_HERO_IMAGE = `${import.meta.env.BASE_URL}image/storefront-frozen-food-hero.png`;

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
  icon: LucideIcon;
  value: string;
  label: string;
  tone: "navy" | "red" | "green";
}) {
  const toneClass = {
    navy: "bg-[#eef2fb] text-[#071a4f]",
    red: "bg-red-50 text-[#e30613]",
    green: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className="commerce-panel-soft flex min-h-[78px] items-center gap-3 p-3.5 md:min-h-[84px] md:p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="h-5 w-5" strokeWidth={2.3} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-extrabold leading-none text-[#071a4f] md:text-2xl">{value}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-500 md:text-sm">{label}</p>
      </div>
    </div>
  );
}

export default function Store() {
  const [shouldRedirectToAnalytics] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem("umami.auth"));
  });
  const [search, setSearch] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyReadyStock, setOnlyReadyStock] = useState(false);
  const [sortMode, setSortMode] = useState<"all" | "discount" | "price-low" | "price-high">("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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

  const handleClearCart = useCallback(() => {
    const currentItems = getCartSummary().items;
    if (currentItems.length === 0) return;

    currentItems.forEach((item) => removeFromCart(item.product.id));
    toast.success("Keranjang dikosongkan");
    window.dispatchEvent(new Event("storage"));
  }, []);

  useEffect(() => {
    if (shouldRedirectToAnalytics) {
      window.location.replace("/analytics");
    }
  }, [shouldRedirectToAnalytics]);

  // Fetch list of stores
  const { data: storeList, isLoading: storesLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const listStores = await locationService.getListStore();
      return listStores as Location[];
    },
    enabled: !shouldRedirectToAnalytics,
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
  }, [handleClearCart, selectedLocationCode]);

  const { data: storeData, error, isLoading: storeDataLoading } = useQuery({
    queryKey: ["store", selectedLocationCode],
    queryFn: async () => {
      const endpoint = `${config.apiUrl}/${selectedLocationCode}/store`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch store data");
      }
      const result = await response.json();
      return result.data as StoreData;
    },
    enabled: !!selectedLocationCode && !shouldRedirectToAnalytics,
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
    enabled: !!storeData?.location_id && !shouldRedirectToAnalytics,
    refetchInterval: 60000, // Check every minute
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
      if (sortMode === "price-high") return calculateFinalPrice(b) - calculateFinalPrice(a);
      return 0;
    });

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
    setSortMode("all");
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  };

  if (shouldRedirectToAnalytics) {
    return null;
  }

  return (
    <AppLayoutCommerce
      title={storeData?.location_name || config.appNameCommerce}
      locationCode={selectedLocationCode}
      openModalInfo={openModalInfoStore}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Cari chicken pokpok, nugget, sosis, bakso..."
    >
      <div className="mx-auto w-full max-w-[1440px] space-y-5 md:space-y-6">
        <section className="space-y-3 md:space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="commerce-hero-card relative overflow-hidden rounded-lg border border-[#14346f] px-5 py-6 text-white shadow-[0_24px_70px_rgba(3,18,61,0.20)] md:px-8 md:py-8 lg:min-h-[430px] lg:px-12 lg:py-10"
          >
            <span aria-hidden="true" className="absolute left-5 top-24 hidden h-28 w-px bg-[#e30613] shadow-[0_0_14px_rgba(227,6,19,0.9)] md:block" />
            <span aria-hidden="true" className="absolute right-[11%] top-7 hidden h-px w-40 bg-sky-400/70 shadow-[0_0_12px_rgba(56,189,248,0.7)] lg:block" />

            <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:items-center lg:gap-10">
              <div className="min-w-0">
                <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-sky-400/50 bg-[#071a4f] px-3 py-2 text-xs font-extrabold uppercase text-white shadow-[0_0_18px_rgba(56,189,248,0.16)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e30613]">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                  Pilihan AMP Mart
                </div>

                <h1 className="max-w-3xl text-[2.1rem] font-extrabold leading-[1.08] text-white md:text-[3.25rem] lg:text-[3.55rem]">
                  Frozen food siap pickup dari outlet terdekat<span className="text-[#e30613]">.</span>
                </h1>
                <p className="mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-300 md:text-lg">
                  Cek stok dan harga terbaru, pilih produk, lalu selesaikan pembayaran dalam satu alur yang ringkas.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button
                    className="commerce-orange-button h-12 rounded-md px-6 text-sm font-extrabold md:h-14 md:px-8 md:text-base"
                    onClick={() => document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    Belanja Sekarang
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-md border-white/70 bg-transparent px-6 text-sm font-extrabold text-white hover:bg-white/10 hover:text-white md:h-14 md:px-8 md:text-base"
                    onClick={() => {
                      setOnlyDiscount(true);
                      document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <Tag className="h-5 w-5" />
                    Lihat Promo
                  </Button>
                </div>

                <div className="mt-7 grid grid-cols-3 divide-x divide-white/15 rounded-lg border border-white/10 bg-[#061742] p-3 md:mt-8 md:p-4">
                  <div className="flex min-w-0 items-center gap-2 pr-2 md:gap-3 md:pr-4">
                    <Snowflake className="h-5 w-5 shrink-0 text-sky-400 md:h-7 md:w-7" />
                    <span className="text-[10px] font-bold leading-tight text-slate-200 md:text-sm">Produk beku berkualitas</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 px-2 md:gap-3 md:px-4">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-sky-400 md:h-7 md:w-7" />
                    <span className="text-[10px] font-bold leading-tight text-slate-200 md:text-sm">Stok terupdate setiap hari</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 pl-2 md:gap-3 md:pl-4">
                    <MapPin className="h-5 w-5 shrink-0 text-sky-400 md:h-7 md:w-7" />
                    <span className="text-[10px] font-bold leading-tight text-slate-200 md:text-sm">Pickup di outlet terdekat</span>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[250px] lg:min-h-[340px]">
                <div className="commerce-hero-photo absolute inset-0 overflow-hidden rounded-lg border border-sky-400/60 bg-[#061742] p-2 shadow-[0_0_32px_rgba(56,189,248,0.18)]">
                <img
                    src={STORE_HERO_IMAGE}
                    alt="Pilihan frozen food AMP Mart dengan bahan segar"
                    className="h-full w-full rounded-md object-cover"
                />
                </div>

                <div className="absolute -bottom-3 left-3 flex max-w-[230px] items-center gap-3 rounded-lg border border-sky-400/40 bg-[#071a4f] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)] md:left-5 lg:-left-8 lg:bottom-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#10347c] text-white">
                    <Snowflake className="h-6 w-6" />
                  </span>
                  <p className="text-xs font-bold leading-relaxed text-slate-100 md:text-sm">Penanganan beku untuk menjaga kualitas produk.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard icon={PackageCheck} value={readyProductCount.toString()} label="Produk tersedia" tone="green" />
            <StatCard icon={BadgePercent} value={`${maxDiscount}%`} label="Diskon tertinggi" tone="red" />
            <StatCard icon={MapPin} value={activeOutletCount.toString()} label="Outlet aktif" tone="navy" />
            <StatCard icon={Boxes} value={(storeData?.total_stock || 0).toString()} label="Total stok outlet" tone="navy" />
          </div>
        </section>

        <div className="commerce-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 md:mx-0 md:px-0">
          {storesLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 w-36 shrink-0 animate-pulse rounded-md bg-muted" />
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

        <PendingPaymentSection />

        <div className="commerce-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 lg:hidden">
          <button type="button" className="commerce-pill h-9 shrink-0 px-4" onClick={() => setMobileFiltersOpen(true)}>
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
            onClick={() => setSortMode(sortMode === "discount" ? "all" : "discount")}
          >
            Diskon tertinggi
          </button>
        </div>

        {operationalStatus?.is_open === false && (
          <div className="commerce-panel-soft sticky top-[104px] z-30 flex items-center justify-between gap-3 border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 md:top-[84px]">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
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
            <div className="commerce-panel-soft sticky top-24 p-5">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-base font-extrabold">Filter Produk</h2>
                <button type="button" className="text-xs font-extrabold text-[#e30613]" onClick={resetFilters}>
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
                  { key: "all", label: "Semua" },
                  { key: "discount", label: "Diskon" },
                  { key: "price-low", label: "Harga Terendah" },
                  { key: "price-high", label: "Harga Tertinggi" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSortMode(item.key as typeof sortMode);
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
                    className="commerce-panel-soft group overflow-hidden p-0 transition-transform"
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
            <div className="commerce-panel sticky top-24 overflow-hidden p-0">
              <div className="bg-primary p-5 text-white">
                <h2 className="text-lg font-extrabold">Keranjang Belanja</h2>
                <p className="mt-1 text-sm font-medium text-white/70">
                  Periksa produk pilihan sebelum melanjutkan ke checkout.
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
                    <Button asChild className="commerce-orange-button h-12 w-full rounded-md text-sm font-extrabold">
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
        <div className="fixed bottom-3 left-3 right-3 z-50 rounded-lg bg-[#071a4f] p-3 text-white shadow-xl md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{totalItems} item · {formatCurrency(total)}</p>
              <p className="truncate text-xs font-medium text-white/70">Siap checkout dari {storeData?.location_name || "outlet"}</p>
            </div>
            <Button asChild className="commerce-orange-button h-11 shrink-0 rounded-md px-5 text-sm font-extrabold">
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

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="commerce-theme max-h-[85vh] rounded-t-lg border-slate-200 px-4 pb-6">
          <SheetHeader className="border-b border-slate-200 pb-4 text-left">
            <SheetTitle className="text-lg font-extrabold text-[#071a4f]">Filter produk</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 overflow-y-auto py-5">
            <div>
              <h3 className="mb-3 text-sm font-extrabold text-[#071a4f]">Kategori</h3>
              <div className="space-y-3">
                {(categories.length > 0 ? categories : ["Frozen Food"]).map((category) => (
                  <label key={category} className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#071a4f]"
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-5">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={onlyDiscount} onChange={() => setOnlyDiscount((value) => !value)} className="h-4 w-4 rounded border-slate-300 accent-[#071a4f]" />
                Hanya produk diskon
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={onlyReadyStock} onChange={() => setOnlyReadyStock((value) => !value)} className="h-4 w-4 rounded border-slate-300 accent-[#071a4f]" />
                Hanya produk tersedia
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" className="rounded-md" onClick={resetFilters}>Reset</Button>
            <Button type="button" className="rounded-md bg-[#071a4f] hover:bg-[#102866]" onClick={() => setMobileFiltersOpen(false)}>
              Tampilkan {filtered.length} produk
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayoutCommerce>
  );
}
