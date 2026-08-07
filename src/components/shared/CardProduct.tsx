import React, { useCallback, useEffect, useState } from "react";
import { Product } from "@/types/product";
import { Button } from "../ui/button";
import { Minus, Package, Plus, ShoppingCart } from "lucide-react";
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

  const syncCartQty = useCallback(() => {
    const item = getCartSummary().items.find((entry) => entry.productId === product.id);
    setCartQty(item?.qty || 0);
  }, [product.id]);

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
  }, [syncCartQty]);

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
        <div className="commerce-product-visual relative flex aspect-[4/3] min-h-[132px] items-center justify-center overflow-hidden rounded-t-lg border-b border-slate-200 sm:min-h-[150px]">
          {!imageLoaded && !imageError && (
            <motion.div
              className="absolute inset-0 z-20 animate-pulse bg-slate-100"
              initial={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}

          {hasDiscount && (
            <div className="absolute left-2.5 top-2.5 z-30 rounded-md bg-[#e30613] px-2 py-1 text-[10px] font-extrabold text-white">
              -{discountPercentage}%
            </div>
          )}

          {!imageError && (
            <img
              src={product.image_url}
              alt={product.name}
              className={`
                relative z-10 h-[84%] w-[84%] object-contain p-2 transition-opacity duration-300 ease-out
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
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
              <Package className="h-9 w-9 text-slate-300" />
            </div>
          )}

          <div className="absolute bottom-2.5 left-2.5 z-30 rounded-md border border-emerald-200 bg-white/95 px-2 py-1 text-[10px] font-extrabold text-emerald-700">
            Stok {product.stock} {product.unit}
          </div>

          {disabled && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#071a4f]/70">
              <span className="rounded-md bg-white px-3 py-1.5 text-xs font-extrabold text-[#071a4f]">
                Toko tutup
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex min-h-[174px] flex-col p-3">
        <div className="min-h-[48px]">
          {product.category && (
            <p className="mb-1 line-clamp-1 text-[10px] font-bold uppercase text-slate-400">{product.category}</p>
          )}
          <Link
            to={disabled ? "#" : urlDetail}
            onClick={(event) => disabled && event.preventDefault()}
            className={`line-clamp-2 text-sm font-extrabold leading-snug text-[#071a4f] ${disabled ? "pointer-events-none" : "hover:text-[#e30613]"}`}
          >
            {product.name}
          </Link>
        </div>

        <div className="mt-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-base font-extrabold text-[#071a4f] sm:text-lg">
              Rp {finalPrice.toLocaleString("id-ID")}
            </p>
            {hasDiscount && (
              <p className="text-[11px] font-semibold text-slate-400 line-through">
                Rp {basePriceWithTax.toLocaleString("id-ID")}
              </p>
            )}
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Harga sudah termasuk pajak</p>
        </div>

        <div className="mt-auto pt-3">
          {product.stock > 0 && !disabled ? (
            cartQty > 0 ? (
              <div className="grid h-10 grid-cols-[40px_1fr_40px] items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full rounded-none text-[#071a4f] hover:bg-slate-200"
                  onClick={handleDecrement}
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-center text-sm font-extrabold text-[#071a4f]">{cartQty}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full rounded-none text-[#071a4f] hover:bg-slate-200"
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
                className="h-10 w-full rounded-md bg-[#071a4f] text-sm font-extrabold text-white hover:bg-[#102866]"
                onClick={handleIncrement}
              >
                <ShoppingCart className="h-4 w-4" />
                Tambah
              </Button>
            )
          ) : product.stock > 0 && disabled ? (
            <Button size="sm" disabled className="h-10 w-full rounded-md">
              Toko tutup
            </Button>
          ) : (
            <Button size="sm" disabled className="h-10 w-full rounded-md">
              Stok Habis
            </Button>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}
