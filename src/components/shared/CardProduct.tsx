import React, { useEffect, useState } from "react";
import { Product } from "@/types/product";
import { Button } from "../ui/button";
import { Heart, Minus, Package, Plus, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCartSummary, removeFromCart, updateCartQty } from "@/lib/storefront";

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
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [cartQty, setCartQty] = useState(0);

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

  const syncCartQty = () => {
    const item = getCartSummary().items.find((entry) => entry.productId === product.id);
    setCartQty(item?.qty || 0);
  };

  const dispatchCartChange = () => {
    window.dispatchEvent(new Event("storage"));
  };

  useEffect(() => {
    const productPrice = product.price || 0;
    const productDiscountPrice = product.discount_price || 0;

    if (
      !productDiscountPrice ||
      productDiscountPrice >= productPrice ||
      productPrice <= 0
    ) {
      setDiscountPercentage(0);
      return;
    }

    setDiscountPercentage(
      Math.round(
        ((productPrice - productDiscountPrice) / productPrice) * 100
      )
    );
  }, [product.price, product.discount_price]);

  useEffect(() => {
    syncCartQty();

    const handleStorageChange = () => syncCartQty();
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [product.id]);

  const taxPercentage = product.tax_percentage || 0;
  const basePriceWithTax = Math.round((product.price || 0) * (1 + taxPercentage / 100));
  const finalPrice = calculateFinalPrice({
    base_price: product.price || 0,
    discount_price: product.discount_price || 0,
    tax_percentage: taxPercentage
  });
  const hasDiscount = discountPercentage > 0;

  const handleIncrement = () => {
    handleAddToCart(
      product.id,
      product.name,
      finalPrice,
      product.image_url || "",
      product.product_stock_id || product.id,
      product.stock,
      taxPercentage
    );
    setTimeout(() => {
      syncCartQty();
      dispatchCartChange();
    }, 0);
  };

  const handleDecrement = () => {
    const nextQty = cartQty - 1;
    if (nextQty <= 0) {
      removeFromCart(product.id);
    } else {
      updateCartQty(product.id, nextQty);
    }
    syncCartQty();
    dispatchCartChange();
  };

  return (
    <React.Fragment>
      <Link
        key={product.id}
        to={disabled ? "#" : urlDetail}
        className={`block ${disabled ? "pointer-events-none opacity-60" : ""}`}
        onClick={(event) => disabled && event.preventDefault()}
      >
        <div className="commerce-product-visual relative flex aspect-[1.13] min-h-[132px] items-center justify-center overflow-hidden rounded-t-[1.125rem] sm:min-h-[152px]">
          {!imageLoaded && !imageError && (
            <motion.div
              className="absolute inset-0 z-20 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200"
              initial={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}

          {hasDiscount && (
            <div className="absolute left-3 top-3 z-30 rounded-full bg-[#ff7a00] px-3 py-1 text-[10px] font-extrabold text-white shadow-lg shadow-orange-500/20">
              Diskon {discountPercentage}%
            </div>
          )}

          <span
            className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-sm transition hover:scale-105"
            aria-hidden="true"
          >
            <Heart className="h-5 w-5" />
          </span>

          {!imageError && (
            <img
              src={product.image_url}
              alt={product.name}
              className={`
                relative z-10 h-[86%] w-[86%] object-contain transition-opacity duration-300 ease-out
                ${imageLoaded ? "opacity-100" : "opacity-0"}
                ${product.stock === 0 ? "grayscale" : ""}
              `}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(true);
                setImageError(true);
              }}
            />
          )}

          {imageError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/20">
              <Package className="h-9 w-9 text-white/70" />
            </div>
          )}

          <div className="absolute bottom-3 left-3 z-30 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-green-600 shadow-sm">
            Ready {product.stock} {product.unit}
          </div>

          {disabled && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35">
              <span className="rounded-full bg-destructive px-3 py-1 text-xs font-extrabold text-white">
                TUTUP
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex min-h-[176px] flex-col p-3 sm:p-4">
        <div className="min-h-[46px]">
          <h3 className={`line-clamp-2 text-sm font-extrabold leading-tight text-foreground transition-colors sm:text-base ${disabled ? "" : "group-hover:text-primary"}`}>
            {product.name}
          </h3>
          {product.category && (
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-muted-foreground">{product.category}</p>
          )}
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-base font-extrabold text-green-600 sm:text-lg">
              Rp {finalPrice.toLocaleString("id-ID")}
            </p>
            {hasDiscount && (
              <p className="text-[11px] font-bold text-destructive line-through">
                Rp {basePriceWithTax.toLocaleString("id-ID")}
              </p>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-muted-foreground">
              Stok: {product.stock} {product.unit}
            </p>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-bold">4.5</span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-3">
          {product.stock > 0 && !disabled ? (
            cartQty > 0 ? (
              <div className="grid h-11 grid-cols-[44px_1fr_44px] items-center overflow-hidden rounded-2xl border border-primary/15 bg-secondary">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full rounded-none text-primary hover:bg-primary/10"
                  onClick={handleDecrement}
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-center text-sm font-extrabold text-primary">{cartQty}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full rounded-none text-primary hover:bg-primary/10"
                  onClick={handleIncrement}
                  disabled={cartQty >= product.stock}
                  aria-label="Tambah jumlah"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-11 w-full rounded-2xl text-sm font-extrabold shadow-lg shadow-primary/20 btn-tap"
                onClick={handleIncrement}
              >
                + Keranjang
              </Button>
            )
          ) : product.stock > 0 && disabled ? (
            <Button size="sm" disabled className="h-11 w-full rounded-2xl">
              Tutup
            </Button>
          ) : (
            <Button size="sm" disabled className="h-11 w-full rounded-2xl">
              Stok Habis
            </Button>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}
