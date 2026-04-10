import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { mockProducts } from "@/lib/mockData";

// Extended product interface for detail view
interface ProductDetail {
  id: string;
  name: string;
  category: string;
  price: number;
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
}

// Mock product data with additional details
const getProductById = (id: string): ProductDetail => {
  const baseProduct = mockProducts.find(p => p.id === id);
  
  if (baseProduct) {
    // Return existing product with additional details
    return {
      id: baseProduct.id,
      name: baseProduct.name,
      category: baseProduct.category,
      price: baseProduct.price,
      image_url: baseProduct.image_url || "/api/placeholder/400/400",
      description: "High-quality coffee beans sourced from the best plantations in Indonesia. Perfect for espresso and manual brewing methods.",
      stock: 15,
      rating: 4.8,
      sold: 234,
      images: baseProduct.display_image_url || [],
      features: [
        "100% Arabica beans",
        "Medium roast profile", 
        "Freshly roasted",
        "Vacuum sealed packaging"
      ],
      shipping: {
        free: true,
        estimated: "2-3 days"
      },
      warranty: "30-day money back guarantee"
    };
  }
  
  // Return default product
  return {
    id: "1",
    name: "Premium Coffee Beans",
    category: "Beverages",
    price: 89000,
    image_url: "/api/placeholder/400/400",
    description: "High-quality coffee beans sourced from the best plantations in Indonesia. Perfect for espresso and manual brewing methods.",
    stock: 15,
    rating: 4.8,
    sold: 234,
    images: [
      "/api/placeholder/400/400",
      "/api/placeholder/400/400",
      "/api/placeholder/400/400",
      "/api/placeholder/400/400"
    ],
    features: [
      "100% Arabica beans",
      "Medium roast profile",
      "Freshly roasted",
      "Vacuum sealed packaging"
    ],
    shipping: {
      free: true,
      estimated: "2-3 days"
    },
    warranty: "30-day money back guarantee"
  };
};

export default function StoreProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const product = getProductById(productId || "1");
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { items, total, totalItems } = getCartSummary();

  // Auto-carousel effect
  useEffect(() => {
    if (isAutoPlaying && product.images.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
        setSelectedImage((prev) => (prev + 1) % product.images.length);
      }, 4000); // Change every 4 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, product.images.length]);

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    addToCart(product.id, quantity);
    
    toast.success(`${quantity} ${product.name} ditambahkan ke keranjang`);
    setIsAddingToCart(false);
  };

  const handleBuyNow = async () => {
    setIsBuyingNow(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear cart first for buy now
    if (items.length > 0) {
      items.forEach(item => removeFromCart(item.productId));
    }
    
    // Add current product
    addToCart(product.id, quantity);
    
    toast.success("Produk ditambahkan, mengalihkan ke checkout...");
    setTimeout(() => {
      window.location.href = "/commerce/cart";
    }, 1000);
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
        className={`h-4 w-4 ${
          i < Math.floor(rating) 
            ? "fill-yellow-400 text-yellow-400" 
            : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <AppLayoutCommerce title={product.name}>
      <div className="max-w-8xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/store" className="hover:text-foreground">
            Store
          </Link>
          <span>/</span>
          <Link to={`/store/category/${product.category}`} className="hover:text-foreground">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
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
                  className="bg-white/90 backdrop-blur"
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
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === index 
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
              <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {renderStars(product.rating)}
                  <span className="text-sm font-medium">{product.rating}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product.sold} terjual)
                </span>
                <Badge variant="secondary">{product.category}</Badge>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  {formatCurrency(product.price)}
                </span>
                <span className="text-sm text-muted-foreground">/pcs</span>
              </div>
              {product.shipping.free && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Truck className="h-4 w-4" />
                  <span>Gratis ongkir</span>
                </div>
              )}
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
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Tambah ke Keranjang
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                className="w-full btn-tap"
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
                    <Package className="h-4 w-4 mr-2" />
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
            <div className="space-y-3">
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
            </div>
          </div>
        </div>

        {/* Product Description */}
        <div className="space-y-6">
          <GlassCard className="p-6">
            <h2 className="text-xl font-semibold mb-4">Deskripsi Produk</h2>
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </GlassCard>

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
                <Button asChild className="w-full btn-tap">
                  <Link to="/store/checkout">
                    Checkout
                  </Link>
                </Button>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </AppLayoutCommerce>
  );
}
