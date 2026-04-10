import { ShoppingBag } from "lucide-react";
import React from "react";
import { Product } from "@/types/product";
import { Button } from "../ui/button";
import { Star } from "lucide-react";


export default function CardProduct({ product, handleAddToCart }: { product: Product, handleAddToCart: (id: string, name: string) => void }) {
    
  return <React.Fragment>
    <div className="aspect-square bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg mb-3 flex items-center justify-center">
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            </div>
            
            <div className="space-y-2 p-3">
              <div>
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <p className="text-xs text-muted-foreground">{product.category}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-primary">
                    Rp {product.price.toLocaleString("id-ID")}
                  </p>
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
                  onClick={() => handleAddToCart(product.id, product.name)}
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
