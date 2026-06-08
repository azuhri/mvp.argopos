import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * ProductImage - A production-ready image component with proper loading states
 *
 * Features:
 * - Full skeleton placeholder during loading (no image visibility)
 * - Smooth fade-in animation when image loads
 * - No overlap between skeleton and image
 * - Error state handling
 * - Optimized for grid views with many products
 * - Maintains border radius via className prop
 *
 * @param src - Image URL
 * @param alt - Alt text for accessibility
 * @param className - Additional classes including border-radius
 * @param skeletonClassName - Custom skeleton styling
 * @param onLoad - Callback when image loads
 * @param onError - Callback when image fails
 * @param errorFallback - Custom error component
 */
export const ProductImage = memo(function ProductImage({
  src,
  alt,
  className,
  skeletonClassName,
  onLoad,
  onError,
  errorFallback,
}: {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
  errorFallback?: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/*
        SKeleton Layer - SELALU di bawah, opacity 1 saat loading
        Menggunakan bg-gradient untuk efek shimmer yang lebih nice
      */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="skeleton"
            className={cn(
              "absolute inset-0 z-10",
              "bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200",
              "dark:from-gray-700 dark:via-gray-800 dark:to-gray-700",
              "animate-pulse",
              skeletonClassName
            )}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/*
        Image Layer - TIDAK PERNAH tampil selama isLoading = true
        Menggunakan opacity transition yang smooth
      */}
      {!hasError && (
        <motion.img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover",
            "transition-opacity duration-300",
            isLoading ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          onLoad={handleLoad}
          onError={handleError}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          loading="lazy"
        />
      )}

      {/*
        Error State - Tampilkan placeholder saat gagal load
      */}
      {hasError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-muted/30"
        >
          {errorFallback || (
            <div className="text-center text-muted-foreground">
              <svg
                className="w-8 h-8 mx-auto mb-1 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs">Gagal memuat</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});

/**
 * ProductImageGrid - Optimized for grid views with many products
 * Uses CSS contain: layout for better rendering performance
 */
export const ProductImageGrid = memo(function ProductImageGrid({
  src,
  alt,
  className,
  skeletonClassName,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        // CSS contain for better scroll performance in grids
        "will-change-transform",
        className
      )}
    >
      {/* Skeleton with shimmer effect */}
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 z-10",
            "bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200",
            "dark:from-gray-700 dark:via-gray-800 dark:to-gray-700",
            "animate-pulse",
            skeletonClassName
          )}
        />
      )}

      {/* Image - hidden until fully loaded */}
      {!hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover",
            "transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <svg
            className="w-6 h-6 text-muted-foreground opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
});

/**
 * ProductImageCarousel - For product detail page with multiple images
 * Handles carousel transitions properly
 */
export const ProductImageCarousel = memo(function ProductImageCarousel({
  images,
  activeIndex,
  alt,
  className,
}: {
  images: string[];
  activeIndex: number;
  alt: string;
  className?: string;
}) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([activeIndex]));
  const [isCurrentLoading, setIsCurrentLoading] = useState(true);

  // Preload adjacent images for smoother carousel experience
  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages((prev) => new Set([...prev, index]));
    if (index === activeIndex) {
      setIsCurrentLoading(false);
    }
  }, [activeIndex]);

  const isLoaded = loadedImages.has(activeIndex);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Skeleton for current image */}
      {isCurrentLoading && (
        <div
          className={cn(
            "absolute inset-0 z-10",
            "bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200",
            "dark:from-gray-700 dark:via-gray-800 dark:to-gray-700",
            "animate-pulse"
          )}
        />
      )}

      {/* Main image */}
      <motion.img
        key={activeIndex}
        src={images[activeIndex]}
        alt={alt}
        className={cn(
          "w-full h-full object-cover",
          "transition-opacity duration-300",
          isCurrentLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => handleImageLoad(activeIndex)}
        initial={{ opacity: 0 }}
        animate={{ opacity: isCurrentLoading ? 0 : 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* Preload adjacent images (hidden) */}
      {images.map((src, index) => (
        index !== activeIndex && (
          <link
            key={index}
            rel="preload"
            as="image"
            href={src}
            onLoad={() => handleImageLoad(index)}
          />
        )
      ))}
    </div>
  );
});
