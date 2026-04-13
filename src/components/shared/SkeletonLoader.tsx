import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Base skeleton component
export const Skeleton = ({ 
  className, 
  variant = "default" 
}: { 
  className?: string; 
  variant?: "default" | "circle" | "text" | "image" | "card" | "table-row";
}) => {
  const variantClasses = {
    default: "rounded-md",
    circle: "rounded-full",
    text: "rounded-sm h-4",
    image: "rounded-lg",
    card: "rounded-xl",
    "table-row": "rounded-sm h-12"
  };

  return (
    <motion.div
      className={cn(
        "bg-gray-200 dark:bg-gray-700 animate-pulse",
        variantClasses[variant],
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    />
  );
};

// Product card skeleton
export const ProductCardSkeleton = () => (
  <div className="glass-card-hover overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
    {/* Image skeleton */}
    <Skeleton variant="image" className="w-full aspect-square" />
    
    {/* Content skeleton */}
    <div className="p-4 space-y-3">
      {/* Title skeleton */}
      <Skeleton variant="text" className="w-3/4" />
      
      {/* Category skeleton */}
      <Skeleton variant="text" className="w-1/2 h-3" />
      
      {/* Price skeleton */}
      <Skeleton variant="text" className="w-1/3 h-5" />
      
      {/* Button skeleton */}
      <Skeleton variant="default" className="w-full h-10" />
    </div>
  </div>
);

// Product detail skeleton
export const ProductDetailSkeleton = () => (
  <div className="max-w-8xl mx-auto px-4 py-6">
    {/* Breadcrumb skeleton */}
    <div className="flex items-center gap-2 mb-6">
      <Skeleton variant="text" className="w-20 h-4" />
      <Skeleton variant="circle" className="w-4 h-4" />
      <Skeleton variant="text" className="w-24 h-4" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Image section skeleton */}
      <div className="space-y-4">
        {/* Main image skeleton */}
        <Skeleton variant="image" className="w-full aspect-square" />
        
        {/* Thumbnail gallery skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="image" className="w-20 h-20 flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Product info skeleton */}
      <div className="space-y-6">
        {/* Title skeleton */}
        <Skeleton variant="text" className="w-3/4 h-8" />
        
        {/* Rating skeleton */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="default" className="w-4 h-4" />
            ))}
          </div>
          <Skeleton variant="text" className="w-20 h-4" />
        </div>

        {/* Price skeleton */}
        <Skeleton variant="text" className="w-1/3 h-10" />

        {/* Quantity selector skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton variant="default" className="w-32 h-10" />
          <Skeleton variant="default" className="w-32 h-10" />
        </div>

        {/* Action buttons skeleton */}
        <div className="space-y-3">
          <Skeleton variant="default" className="w-full h-12" />
          <Skeleton variant="default" className="w-full h-12" />
        </div>

        {/* Features skeleton */}
        <div className="space-y-2">
          <Skeleton variant="text" className="w-1/4 h-5" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton variant="circle" className="w-4 h-4" />
              <Skeleton variant="text" className="w-2/3 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Cart item skeleton
export const CartItemSkeleton = () => (
  <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    {/* Product image skeleton */}
    <Skeleton variant="image" className="w-16 h-16 flex-shrink-0" />
    
    {/* Product info skeleton */}
    <div className="flex-1 space-y-2">
      <Skeleton variant="text" className="w-1/2 h-5" />
      <Skeleton variant="text" className="w-1/3 h-4" />
    </div>
    
    {/* Quantity controls skeleton */}
    <div className="flex items-center gap-2">
      <Skeleton variant="default" className="w-8 h-8" />
      <Skeleton variant="text" className="w-8 h-4" />
      <Skeleton variant="default" className="w-8 h-8" />
    </div>
    
    {/* Price skeleton */}
    <Skeleton variant="text" className="w-20 h-5" />
    
    {/* Remove button skeleton */}
    <Skeleton variant="circle" className="w-8 h-8" />
  </div>
);

// Cart summary skeleton
export const CartSummarySkeleton = () => (
  <div className="space-y-4 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    {/* Summary items skeleton */}
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex justify-between">
        <Skeleton variant="text" className="w-24 h-4" />
        <Skeleton variant="text" className="w-20 h-4" />
      </div>
    ))}
    
    {/* Total skeleton */}
    <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="w-16 h-6" />
        <Skeleton variant="text" className="w-24 h-6" />
      </div>
    </div>
    
    {/* Checkout button skeleton */}
    <Skeleton variant="default" className="w-full h-12" />
  </div>
);

// Table skeleton
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    {/* Header skeleton */}
    <div className="flex gap-4 pb-2 border-b">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} variant="text" className="flex-1 h-5" />
      ))}
    </div>
    
    {/* Row skeletons */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 py-2">
        {[1, 2, 3, 4, 5].map((j) => (
          <Skeleton key={j} variant="table-row" className="flex-1" />
        ))}
      </div>
    ))}
  </div>
);

// Grid skeleton
export const GridSkeleton = ({ 
  items = 8, 
  cols = 4 
}: { 
  items?: number; 
  cols?: number;
}) => (
  <div 
    className={`grid gap-4 grid-cols-${Math.min(cols, 1)} sm:grid-cols-${Math.min(cols, 2)} md:grid-cols-${Math.min(cols, 3)} lg:grid-cols-${cols}`}
  >
    {Array.from({ length: items }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

// Loading spinner component
export const LoadingSpinner = ({ 
  size = "md", 
  text 
}: { 
  size?: "sm" | "md" | "lg"; 
  text?: string;
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        className={cn(
          "border-2 border-primary border-t-transparent rounded-full animate-spin",
          sizeClasses[size]
        )}
      />
      {text && (
        <motion.p
          className="text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

// Page loading skeleton
export const PageSkeleton = ({ 
  showHeader = true,
  showSidebar = false 
}: { 
  showHeader?: boolean;
  showSidebar?: boolean;
}) => (
  <div className="flex min-h-screen">
    {/* Sidebar skeleton */}
    {showSidebar && (
      <div className="w-64 bg-card/50 p-4 space-y-4">
        <Skeleton variant="text" className="w-32 h-8" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="text" className="w-full h-4" />
        ))}
      </div>
    )}

    {/* Main content skeleton */}
    <div className="flex-1">
      {/* Header skeleton */}
      {showHeader && (
        <div className="bg-card/50 p-6 border-b space-y-4">
          <Skeleton variant="text" className="w-48 h-8" />
          <div className="flex gap-4">
            <Skeleton variant="default" className="w-32 h-10" />
            <Skeleton variant="default" className="w-32 h-10" />
          </div>
        </div>
      )}

      {/* Content skeleton */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="card" className="h-32" />
          ))}
        </div>
        
        <Skeleton variant="card" className="h-96" />
      </div>
    </div>
  </div>
);

// Image loading skeleton with fade-in effect
export const ImageSkeleton = ({ 
  src, 
  alt, 
  className,
  onLoad,
  onError 
}: { 
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <Skeleton variant="image" className="absolute inset-0 w-full h-full" />
      )}
      
      {!hasError && (
        <motion.img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={handleLoad}
          onError={handleError}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      
      {hasError && (
        <div className="flex items-center justify-center w-full h-full bg-muted/50">
          <div className="text-center">
            <div className="text-muted-foreground text-sm">Failed to load image</div>
          </div>
        </div>
      )}
    </div>
  );
};
