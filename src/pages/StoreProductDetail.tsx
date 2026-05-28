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
  image_collection_url?: string[] | string; // Can be array or JSON string from backend
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

// Extended product interface for detail view
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
  shipping: {
    free: boolean;
    estimated: string;
  };
  warranty: string;
  isOutOfStock: boolean;
}

export default function StoreProductDetail() {
  const { locationCode, productId } = useParams<{ locationCode: string; productId: string }>();

  // All state hooks must be called before any conditional logic
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch store data from backend API
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

  // Find product from store data
  const productStock = storeData?.product_stores.find(p => p.id === productId);
  // console.log(productStock);


  // Build product detail from API data
  const product: ProductDetail | null = productStock ? {
    id: productStock.id,
    name: productStock.master_product.product_name,
    product_code: productStock.master_product.product_code,
    category: productStock.master_product.category || "General",
    price: productStock.base_price,
    discount_price: productStock.discount_price || 0,
    tax_percentage: productStock?.tax_percentage || 0,
    // Build full image URL using backend base URL + image_path
    image_url: productStock.master_product.image_url || `${config.apiUrl}/uploads/${productStock.master_product.image_path}`,
    description: productStock.master_product.description || "High-quality product from our store.",
    stock: productStock.stock,
    rating: 4.8,
    sold: 234,
    // Build image collection URLs - handle if it's a string or array
    images: (() => {
      const collection = productStock.master_product.image_collection_url;
      let imageArray: string[] = [];

      if (Array.isArray(collection)) {
        imageArray = collection;
      } else if (typeof collection === 'string' && collection) {
        // If backend sends JSON string, try to parse it
        try {
          const parsed = JSON.parse(collection);
          imageArray = Array.isArray(parsed) ? parsed : [collection];
        } catch {
          imageArray = [collection];
        }
      }

      if (imageArray.length > 0) {
        return imageArray.map(img =>
          img?.startsWith('http') ? img : `${config.apiUrl}/${img}`
        );
      }

      // Fallback to main image
      const mainImage = `${config.apiUrl}/${productStock.master_product.image_path}`;
      return [mainImage];
    })(),
    features: [
      "High quality",
      "Fresh stock",
      "Best price"
    ],
    shipping: {
      free: true,
      estimated: "2-3 days"
    },
    warranty: "30-day money back guarantee",
    isOutOfStock: productStock.stock === 0
  } : null;

  const { items, total, totalItems } = getCartSummary();

  // All useEffect hooks must be called before any conditional returns
  // Auto-carousel effect
  useEffect(() => {
    if (!product || !isAutoPlaying || product.images.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
      setSelectedImage((prev) => (prev + 1) % product.images.length);
    }, 4000); // Change every 4 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, product?.images?.length]);

  // Handle loading state - after all hooks
  if (isLoading) {
    return (
      <AppLayoutCommerce title="Loading..." locationCode={locationCode || ''}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayoutCommerce>
    );
  }

  // Handle error or product not found - after all hooks
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

  // Continue with the rest of the component...
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
      price: product.price,
      imageUrl: product.image_url,
      category: product.category,
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

    // Clear cart first for buy now
    if (items.length > 0) {
      items.forEach(item => removeFromCart(item.productId));
    }

    // Add current product with stock validation
    const result = addToCart(product.id, quantity, {
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      category: product.category,
    }, product.stock);

    if (result.success) {
      toast.success("Produk ditambahkan, mengalihkan ke checkout...");
      setTimeout(() => {
        window.location.href = `/commerce/cart`;
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
    // Pause auto-play when user manually navigates
    setIsAutoPlaying(false);
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    setSelectedImage((prev) => (prev + 1) % product.images.length);

    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevImage = () => {
    // Pause auto-play when user manually navigates
    setIsAutoPlaying(false);
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length);

    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const handleThumbnailClick = (index: number) => {
    // Pause auto-play when user manually selects
    setIsAutoPlaying(false);
    setCurrentImageIndex(index);
    setSelectedImage(index);

    // Resume auto-play after 10 seconds
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

  return (
    <AppLayoutCommerce title={`${storeData.location_name}`} locationCode={locationCode || ''}>
      <div className={`max-w-8xl mx-auto px-4 py-6 ${product.isOutOfStock ? 'grayscale' : ''}`}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={`/commerce`} className="hover:text-foreground">
            Commerce
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImageIndex}
                  src={product.images[currentImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0, scale: 0.95, x: 50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.05, x: -50 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                />
              </AnimatePresence>

              {/* Progress Indicator */}
              {isAutoPlaying && product.images.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4 flex gap-1">
                  {product.images.map((_, index) => (
                    <motion.div
                      key={index}
                      className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
                    >
                      <motion.div
                        className="h-full bg-white rounded-full"
                        initial={{ width: "0%" }}
                        animate={{
                          width: index === currentImageIndex ? "100%" : "0%"
                        }}
                        transition={{
                          duration: 4,
                          ease: "linear"
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Image Navigation */}
              <motion.div
                className="absolute left-2 top-1/2 -translate-y-1/2 flex gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/80 backdrop-blur hover:bg-white/90 transition-all"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>

              <motion.div
                className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/80 backdrop-blur hover:bg-white/90 transition-all"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>

              {/* Stock Badge */}
              <motion.div
                className="absolute top-2 right-2"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Badge
                  variant={product.stock > 5 ? "default" : "destructive"}
                  className="bg-white/40 backdrop-blur"
                >
                  {product.stock > 5 ? `Stok: ${product.stock}` : "Habis"}
                </Badge>
              </motion.div>

              {/* Favorite Button */}
              <motion.div
                className="absolute bottom-2 right-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/80 backdrop-blur hover:bg-white/90 transition-all"
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* Thumbnail Gallery */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((image, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleThumbnailClick(index)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === index
                    ? "border-primary scale-105"
                    : "border-transparent hover:border-muted hover:scale-105"
                    }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {selectedImage === index && (
                    <motion.div
                      className="absolute inset-0 bg-primary/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Product Information */}
          <div className="space-y-6">
            {/* Product Title and Rating */}
            <div>
              <div className="flex flex-col gap-1 mb-2">
                <h1 className="text-2xl font-bold">{product.name}</h1>
                <div>
                  <span className="text-sm text-muted-foreground">code: </span>
                  <Badge variant="secondary">{product.product_code}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {renderStars(product.rating)}
                  <span className="text-sm font-medium">{product.rating}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product.sold} terjual)
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <div className="flex md:flex-row flex-col gap-1">
                  <p className={`font-semibold line-through text-xl ${product.discount_price > 0 ? 'text-xl text-destructive' : 'no-underline text-primary'}`}>
                    Rp {(product.price).toLocaleString("id-ID")}
                  </p>
                  {product.discount_price > 0 && (
                    <p className={`font-bold text-md text-success text-3xl font-bold text-primary`}>
                      Rp {(product.discount_price).toLocaleString("id-ID")}
                    </p>
                  )}

                </div>
                {/* <span className="text-3xl font-bold text-primary">
                  {formatCurrency(product.price)}
                </span> */}
                <span className="text-sm text-muted-foreground">/pcs</span>
              </div>
              <GlassCard className="p-4">
                <h2 className="text-xl font-semibold mb-4">Deskripsi Produk</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </GlassCard>
              {/* {product.shipping.free && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Truck className="h-4 w-4" />
                  <span>Gratis ongkir</span>
                </div>
              )} */}
            </div>

            {/* Quantity Selector */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Jumlah</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="w-16 text-center font-medium">
                  {quantity}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= product.stock}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  Stok: {product.stock}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full btn-tap"
                onClick={handleAddToCart}
                disabled={isAddingToCart || product.stock === 0}
              >
                {isAddingToCart ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                    Menambahkan...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={50} strokeWidth={2.5} />
                    Tambah ke Keranjang
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full btn-tap border-gray-900"
                onClick={handleBuyNow}
                disabled={isBuyingNow || product.stock === 0}
              >
                {isBuyingNow ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
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

            {/* Product Features */}
            <div className="space-y-3">
              <h3 className="font-medium">Fitur Produk</h3>
              <div className="space-y-2">
                {product.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Info */}
            {/* <div className="space-y-3">
              <h3 className="font-medium">Pengiriman</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>Estimasi: {product.shipping.estimated}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{product.warranty}</span>
                </div>
              </div>
            </div> */}
          </div>
        </div>

        {/* Product Description */}
        <div className="space-y-6">
          {/* Cart Summary */}
          {items.length > 0 && (
            <GlassCard className="p-6">
              <h2 className="text-xl font-semibold mb-4">Ringkasan Keranjang</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <h4 className="font-medium text-sm">{item.product.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} × {formatCurrency(item.product.price)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total ({totalItems} items)</span>
                  <span className="text-lg text-primary">{formatCurrency(total)}</span>
                </div>
                <div className="space-y-3">
                  <Button asChild className="w-full btn-tap">
                    <Link to={`/commerce/checkout`}>
                      Checkout
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleClearCart}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Kosongkan Keranjang
                  </Button>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </AppLayoutCommerce>
  );
}
