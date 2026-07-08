import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import {
  Minus, Plus, ShoppingCart, Star, Heart, Share2,
  ChevronLeft, ChevronRight, Package, Truck, Shield,
  ArrowLeft, Check, Info
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getCartSummary,
  addToCart,
  updateCartQty,
  removeFromCart
} from "@/lib/storefront";
import { formatCurrency } from "@/lib/mockData";
import { config } from "@/lib/config";
import { toast } from "sonner";
import { AppLayoutCommerce } from "@/components/layout/AppLayoutCommerce";
import { useQuery } from "@tanstack/react-query";

// Interfaces for API data
interface MasterProduct {
  id: string;
  product_name: string;
  product_code: string;
  description?: string;
  image_path: string;
  image_url: string;
  image_collection_url?: string[] | string;
  category?: string;
}

interface ProductStock {
  id: string;
  stock: number;
  base_price: number;
  discount_price: number;
  final_price: number;
  tax_percentage?: number;
  master_product: MasterProduct;
}

interface StoreData {
  location_id: string;
  location_name: string;
  location_code: string;
  total_stock: number;
  product_stores: ProductStock[];
}

interface ProductDetail {
  id: string;
  name: string;
  product_code: string;
  category: string;
  price: number;
  discount_price: number;
  tax_percentage: number;
  image_url: string;
  description: string;
  stock: number;
  rating: number;
  sold: number;
  images: string[];
  features: string[];
  shipping: { free: boolean; estimated: string };
  warranty: string;
  isOutOfStock: boolean;
}

// All hooks must be at the top level
export default function StoreProductDetail() {
  const { locationCode, productId } = useParams<{ locationCode: string; productId: string }>();

  // State hooks - all at the top
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [mainImageError, setMainImageError] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState<Record<number, boolean>>({});
  const [thumbnailError, setThumbnailError] = useState<Record<number, boolean>>({});
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Ref
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Query - after all state hooks
  const { data: storeData, error, isLoading } = useQuery({
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

  // Find product
  const productStock = storeData?.product_stores.find(p => p.id === productId);

  // Build product detail - using useMemo for performance
  const product: ProductDetail | null = productStock ? {
    id: productStock.id,
    name: productStock.master_product.product_name,
    product_code: productStock.master_product.product_code,
    category: productStock.master_product.category || "General",
    price: productStock.base_price,
    discount_price: productStock.discount_price || 0,
    tax_percentage: productStock?.tax_percentage || 0,
    image_url: `${config.endpointUrl}/${productStock.master_product.image_path}` || productStock.master_product.image_url,
    description: productStock.master_product.description || "High-quality product from our store.",
    stock: productStock.stock,
    rating: 4.8,
    sold: 234,
    images: (() => {
      const collection = productStock.master_product.image_collection_url;
      let imageArray: string[] = [];

      if (Array.isArray(collection)) {
        imageArray = collection;
      } else if (typeof collection === 'string' && collection) {
        try {
          const parsed = JSON.parse(collection);
          imageArray = Array.isArray(parsed) ? parsed : [collection];
        } catch {
          imageArray = [collection];
        }
      }

      if (imageArray.length > 0) {
        return imageArray.map(img =>
          img?.startsWith('http') ? img : `${config.endpointUrl}/${img}`
        );
      }

      const mainImage = `${config.endpointUrl}/${productStock.master_product.image_path}`;
      return [mainImage];
    })(),
    features: ["High quality", "Fresh stock", "Best price"],
    shipping: { free: true, estimated: "2-3 days" },
    warranty: "30-day money back guarantee",
    isOutOfStock: productStock.stock === 0
  } : null;

  // Cart summary
  const { items, total, totalItems } = getCartSummary();

  // Image handlers
  const handleMainImageLoad = () => setMainImageLoaded(true);
  const handleMainImageError = () => {
    setMainImageLoaded(true);
    setMainImageError(true);
  };
  const handleThumbnailLoad = (index: number) => {
    setThumbnailLoaded(prev => ({ ...prev, [index]: true }));
  };
  const handleThumbnailError = (index: number) => {
    setThumbnailLoaded(prev => ({ ...prev, [index]: true }));
    setThumbnailError(prev => ({ ...prev, [index]: true }));
  };

  // Effect - auto-carousel (after all state hooks and before conditional returns)
  useEffect(() => {
    if (!product || !isAutoPlaying || product.images.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
      setSelectedImage((prev) => (prev + 1) % product.images.length);
    }, 4000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, product?.images?.length]);

  // Helper function
  const calculateFinalPrice = (stock: {
    base_price: number;
    discount_price: number;
    tax_percentage: number;
  }) => {
    const basePrice = stock.base_price;
    const discountPrice = stock.discount_price || 0;
    const taxPercentage = stock.tax_percentage || 0;
    const price = discountPrice > 0 ? discountPrice : basePrice;
    const tax = price * (taxPercentage / 100);
    return Math.round(price + tax);
  };

  // Conditional returns AFTER all hooks
  if (isLoading) {
    return (
      <AppLayoutCommerce title="Loading..." locationCode={locationCode || ''}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayoutCommerce>
    );
  }

  if (error || !product) {
    return (
      <AppLayoutCommerce title="Product Not Found" locationCode={locationCode || ''}>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-6">Unable to load product data</p>
          <Button asChild>
            <Link to={`/commerce`}>Back to Store</Link>
          </Button>
        </div>
      </AppLayoutCommerce>
    );
  }

  // Event handlers
  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = async () => {
    if (product.isOutOfStock) {
      toast.error("Produk tidak tersedia (stok habis)");
      return;
    }

    setIsAddingToCart(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = addToCart(product.id, quantity, {
      name: product.name,
      price: calculateFinalPrice({
        base_price: product.price,
        discount_price: product.discount_price,
        tax_percentage: product.tax_percentage,
      }),
      imageUrl: product.image_url,
      category: product.category,
      tax_percentage: product.tax_percentage,
    }, product.stock);

    if (result.success) {
      toast.success(`${quantity} ${product.name} ditambahkan ke keranjang`);
    } else {
      toast.error(result.message);
    }
    setIsAddingToCart(false);
  };

  const handleBuyNow = async () => {
    if (product.isOutOfStock) {
      toast.error("Produk tidak tersedia (stok habis)");
      return;
    }

    setIsBuyingNow(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    if (items.length > 0) {
      items.forEach(item => removeFromCart(item.productId));
    }

    const result = addToCart(product.id, quantity, {
      name: product.name,
      price: calculateFinalPrice({
        base_price: product.price,
        discount_price: product.discount_price,
        tax_percentage: product.tax_percentage,
      }),
      imageUrl: product.image_url,
      category: product.category,
      tax_percentage: product.tax_percentage
    }, product.stock);

    if (result.success) {
      toast.success("Produk ditambahkan, mengalihkan ke checkout...");
      setTimeout(() => {
        window.location.href = `/celestia/${locationCode}/commerce/cart`;
      }, 1000);
    } else {
      toast.error(result.message);
      setIsBuyingNow(false);
    }
  };

  const handleClearCart = () => {
    if (items.length > 0) {
      items.forEach(item => removeFromCart(item.productId));
      toast.success("Keranjang dikosongkan");
    }
  };

  const nextImage = () => {
    setIsAutoPlaying(false);
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    setSelectedImage((prev) => (prev + 1) % product.images.length);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevImage = () => {
    setIsAutoPlaying(false);
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const handleThumbnailClick = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentImageIndex(index);
    setSelectedImage(index);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating)
          ? "fill-yellow-400 text-yellow-400"
          : "text-gray-300"
          }`}
      />
    ));
  };

  const basePriceDisplay = Math.round(product.price * (1 + product.tax_percentage / 100));
  const finalPriceDisplay = calculateFinalPrice({
    base_price: product.price,
    discount_price: product.discount_price,
    tax_percentage: product.tax_percentage,
  });
  const cartUrl = locationCode ? `/${locationCode}/commerce/cart` : "/commerce/cart";

  return (
    <AppLayoutCommerce title={`${storeData.location_name}`} locationCode={locationCode || ''}>
      <div className={`mx-auto w-full max-w-[1240px] space-y-6 ${product.isOutOfStock ? 'grayscale' : ''}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button variant="outline" size="sm" asChild className="w-fit rounded-2xl font-extrabold">
            <Link to="/commerce">
              <ArrowLeft className="h-4 w-4" />
              Kembali Belanja
            </Link>
          </Button>
          <div className="text-left md:text-right">
            <p className="text-sm font-bold text-muted-foreground">{storeData.location_name}</p>
            <p className="text-xs font-semibold text-muted-foreground">Kode produk: {product.product_code}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)]">
          <div className="space-y-4">
            <div className="commerce-panel overflow-hidden p-3 md:p-4">
              <div className="commerce-product-visual relative aspect-square overflow-hidden rounded-[1.25rem]">
              {!mainImageLoaded && !mainImageError && (
                <motion.div
                  className="absolute inset-0 z-20 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200"
                  initial={{ opacity: 1 }}
                />
              )}

              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImageIndex}
                  src={product.images[currentImageIndex]}
                  alt={product.name}
                  className={`h-full w-full object-contain p-8 transition-opacity duration-400 ease-out ${mainImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={handleMainImageLoad}
                  onError={handleMainImageError}
                  initial={{ opacity: 0, scale: 0.95, x: 50 }}
                  animate={{ opacity: mainImageLoaded ? 1 : 0, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.05, x: -50 }}
                  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </AnimatePresence>

              {/* Progress Indicator */}
              {isAutoPlaying && product.images.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4 flex gap-1">
                  {product.images.map((_, index) => (
                    <motion.div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-white rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: index === currentImageIndex ? "100%" : "0%" }}
                        transition={{ duration: 4, ease: "linear" }}
                      />
                    </motion.div>
                  ))}
                </div>
              )}

              <motion.div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-white/90 backdrop-blur hover:bg-white" onClick={prevImage}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>

              <motion.div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-white/90 backdrop-blur hover:bg-white" onClick={nextImage}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>

              <motion.div className="absolute left-4 top-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Badge variant={product.stock > 5 ? "default" : "destructive"} className="rounded-full px-3 py-1 font-extrabold shadow-lg">
                  {product.stock > 5 ? `Ready ${product.stock} pack` : "Habis"}
                </Badge>
              </motion.div>

              <motion.div className="absolute bottom-4 right-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-white/90 backdrop-blur hover:bg-white">
                    <Heart className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>
            </div>

            <div className="commerce-scrollbar flex gap-3 overflow-x-auto pb-1">
              {product.images.map((image, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleThumbnailClick(index)}
                  className={`commerce-panel-soft h-20 w-20 flex-shrink-0 overflow-hidden p-1 transition-all ${selectedImage === index
                    ? "border-primary scale-105"
                    : "hover:border-muted hover:scale-105"
                    }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="commerce-product-visual relative h-full w-full overflow-hidden rounded-xl">
                    {!thumbnailLoaded[index] && !thumbnailError[index] && (
                      <div className="absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200" />
                    )}
                    {!thumbnailError[index] && (
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className={`h-full w-full object-contain transition-opacity duration-300 ease-out ${thumbnailLoaded[index] ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => handleThumbnailLoad(index)}
                        onError={() => handleThumbnailError(index)}
                      />
                    )}
                    {thumbnailError[index] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                        <Package className="h-5 w-5 text-white/70" />
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="commerce-panel p-5 md:p-7">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 font-extrabold">
                  {product.category}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 font-bold">
                  {product.product_code}
                </Badge>
              </div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-normal md:text-4xl">{product.name}</h1>
              <div className="flex items-center gap-4">
                <div className="mt-4 flex items-center gap-1">
                  {renderStars(product.rating)}
                  <span className="text-sm font-extrabold">{product.rating}</span>
                </div>
                <span className="mt-4 text-sm font-semibold text-muted-foreground">({product.sold} terjual)</span>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-3xl font-extrabold text-green-600 md:text-4xl">
                  Rp {finalPriceDisplay.toLocaleString("id-ID")}
                </p>
                {product.discount_price > 0 && (
                  <p className="pb-1 text-base font-bold text-destructive line-through">
                    Rp {basePriceDisplay.toLocaleString("id-ID")}
                  </p>
                )}
                <span className="pb-1 text-sm font-semibold text-muted-foreground">/pcs</span>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <h2 className="mb-2 text-lg font-extrabold">Deskripsi Produk</h2>
                <p className="leading-relaxed text-muted-foreground">{product.description}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-sm font-extrabold">Jumlah</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid h-12 grid-cols-[48px_64px_48px] overflow-hidden rounded-2xl border border-primary/15 bg-secondary">
                <Button variant="ghost" className="h-full rounded-none text-primary hover:bg-primary/10" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center text-sm font-extrabold text-primary">{quantity}</div>
                <Button variant="ghost" className="h-full rounded-none text-primary hover:bg-primary/10" onClick={() => handleQuantityChange(1)} disabled={quantity >= product.stock}>
                  <Plus className="h-4 w-4" />
                </Button>
                </div>
                <span className="text-sm font-bold text-muted-foreground">Stok: {product.stock} pack</span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button size="lg" className="h-12 w-full rounded-2xl font-extrabold btn-tap" onClick={handleAddToCart} disabled={isAddingToCart || product.stock === 0}>
                {isAddingToCart ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Menambahkan...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={50} strokeWidth={2.5} />
                    Tambah ke Keranjang
                  </>
                )}
              </Button>

              <Button size="lg" className="commerce-orange-button h-12 w-full rounded-2xl font-extrabold btn-tap" onClick={handleBuyNow} disabled={isBuyingNow || product.stock === 0}>
                {isBuyingNow ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Package size={50} strokeWidth={2.5} />
                    Beli Langsung
                  </>
                )}
              </Button>
            </div>

            <div className="mt-7 space-y-3">
              <h3 className="font-extrabold">Fitur Produk</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {product.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 text-sm font-bold">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="commerce-panel p-5 md:p-6">
              <h2 className="mb-4 text-xl font-extrabold">Ringkasan Keranjang</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className="commerce-product-visual h-12 w-12 overflow-hidden rounded-xl">
                        <img src={item.product.image_url} alt={item.product.name} className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold">{item.product.name}</h4>
                        <p className="text-xs text-muted-foreground">{item.qty} × {formatCurrency(item.product.price)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-green-600">{formatCurrency(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between font-extrabold">
                  <span>Total ({totalItems} items)</span>
                  <span className="text-lg text-primary">{formatCurrency(total)}</span>
                </div>
                <div className="space-y-3">
                  <Button asChild className="commerce-orange-button h-12 w-full rounded-2xl font-extrabold btn-tap">
                    <Link to={cartUrl}>Checkout</Link>
                  </Button>
                  <Button variant="outline" className="h-12 w-full rounded-2xl font-extrabold" onClick={handleClearCart}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Kosongkan Keranjang
                  </Button>
                </div>
              </div>
          </div>
        )}
      </div>
    </AppLayoutCommerce>
  );
}
