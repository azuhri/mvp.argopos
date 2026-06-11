import React, { useState } from "react";
import { Product } from "@/types/product";
import { Button } from "../ui/button";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function CardProduct({ product, handleAddToCart, urlDetail, disabled }: {
  product: Product & { product_stock_id?: string },
  urlDetail: string,
  handleAddToCart: (
    id: string,
    name: string,
    price: number,
    imageUrl: string,
    productStockId: string,
    productStock: number,
    tax_percentage: number,
  ) => void,
  disabled?: boolean
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  return <React.Fragment>
    <Link
      key={product.id}
      to={disabled ? "#" : urlDetail}
      className={`block ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      onClick={(e) => disabled && e.preventDefault()}
    >
      <div className="aspect-square bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
        {/* Skeleton Layer - Full coverage, z-10 */}
        {!imageLoaded && !imageError && (
          <motion.div
            className="absolute inset-0 z-20 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700 animate-pulse"
            initial={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Image Layer - Full opacity transition */}
        {!imageError && (
          <img
            src={product.image_url}
            alt={product.name}
            className={`
              h-full w-full object-cover
              transition-opacity duration-300 ease-out
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              ${product.stock === 0 ? 'grayscale' : ''}
            `}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageLoaded(true);
              setImageError(true);
            }}
          />
        )}

        {/* Error State */}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
            <svg className="w-8 h-8 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Closed overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-30">
            <span className="text-white text-xs font-medium bg-destructive px-2 py-1 rounded">
              TUTUP
            </span>
          </div>
        )}
      </div>
    </Link>

    <div className="space-y-2 p-3">
      <div>
        <h3 className={`font-medium text-sm sm:text-lg line-clamp-2 ${disabled ? '' : 'group-hover:text-primary'} transition-colors`}>
          {product.name}
        </h3>
        <p className="text-xs text-muted-foreground">{product.category}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex md:flex-row items-start flex-col">
            <p className={`font-semibold line-through text-md ${product.discount_price > 0 ? 'text-xs text-destructive' : 'no-underline text-primary'}`}>
              Rp {Math.round(product.price * (1 + product.tax_percentage / 100)).toLocaleString("id-ID")}
            </p>
            {product.discount_price > 0 && (
              <p className={`font-semibold text-md text-success`}>
                Rp {calculateFinalPrice({
                  base_price: product.price,
                  discount_price: product.discount_price,
                  tax_percentage: product.tax_percentage
                }).toLocaleString("id-ID")}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Stok: {product.stock} {product.unit}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs">4.5</span>
        </div>
      </div>

      {product.stock > 0 && !disabled ? (
        <Button
          size="sm"
          className="w-full btn-tap"
          onClick={() => handleAddToCart(
            product.id,
            product.name,
            calculateFinalPrice({
              base_price: product.price,
              discount_price: product.discount_price,
              tax_percentage: product.tax_percentage
            }),
            product.image_url || '',
            product.product_stock_id || product.id,
            product.stock,
            product.tax_percentage
          )}
        >
          + Keranjang
        </Button>
      ) : product.stock > 0 && disabled ? (
        <Button size="sm" disabled className="w-full">
          Tutup
        </Button>
      ) : (
        <Button size="sm" disabled className="w-full">
          Stok Habis
        </Button>
      )}
    </div>
  </React.Fragment>;
}
