import React from "react";
import { Product } from "@/types/product";
import { Button } from "../ui/button";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function CardProduct({ product, handleAddToCart, urlDetail }: {
  product: Product & { product_stock_id?: string },
  urlDetail: string,
  handleAddToCart: (
    id: string,
    name: string,
    price: number,
    imageUrl: string,
    category: string,
    productStockId: string
  ) => void
}) {

  
  return <React.Fragment>
    <Link
      key={product.id}
      to={urlDetail}
      className="block"
    >
      <div className="aspect-square bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg mb-3 flex items-center justify-center">
        <img src={product.image_url} alt={product.name} className={`h-full w-full ${product.stock === 0 ? 'grayscale' : ''} object-cover`} />
      </div>
    </Link>

    <div className="space-y-2 p-3">
      <div>
        <h3 className="font-medium text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="text-xs text-muted-foreground">{product.category}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex md:flex-row items-center flex-col gap-1">
            <p className={`font-semibold line-through text-md ${product.discount_price > 0 ? 'text-xs text-destructive' : 'no-underline text-primary'}`}>
              Rp {(product.price).toLocaleString("id-ID")}
            </p>
            {product.discount_price > 0 && (
              <p className={`font-bold text-md text-success`}>
                Rp {(product.discount_price).toLocaleString("id-ID")}
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

      {product.stock > 0 ? (
        <Button
          size="sm"
          className="w-full btn-tap"
          onClick={() => handleAddToCart(product.id, product.name, product.price, product.image_url || '', product.category, product.product_stock_id || product.id)}
        >
          + Keranjang
        </Button>
      ) : (
        <Button size="sm" disabled className="w-full">
          Stok Habis
        </Button>
      )}
    </div>
  </React.Fragment>;
}
