import type { CartItem } from "@/lib/storefront";

export interface CheckoutCatalogStock {
  id: string;
  stock: number;
  base_price: number;
  discount_price?: number;
  tax_percentage?: number;
  status?: boolean;
  master_product: {
    product_name: string;
    image_path?: string;
    image_url?: string;
    category?: string;
  };
}

// Keep every stored row visible until the customer explicitly removes it. A
// cached name/price is a display fallback, never proof of catalog membership.
export function buildCheckoutCart(stored: CartItem[], catalog?: CheckoutCatalogStock[], assetBase = "") {
  const stockById = new Map((catalog ?? []).map((stock) => [stock.id, stock]));
  const items = stored.map((item) => {
    const current = stockById.get(item.productId);
    const unavailable = catalog !== undefined && (!current || current.status === false);
    const tax = current ? current.tax_percentage ?? 0 : item.tax_percentage ?? 0;
    const basePrice = current ? (current.discount_price && current.discount_price > 0 ? current.discount_price : current.base_price) : 0;
    const price = current ? Math.round(basePrice * (1 + tax / 100)) : item.productPrice ?? 0;
    const name = current?.master_product.product_name ?? item.productName ?? "Produk tersimpan";
    const imagePath = current?.master_product.image_path;
    const image = imagePath
      ? (/^https?:\/\//.test(imagePath) ? imagePath : `${assetBase.replace(/\/$/, "")}/${imagePath.replace(/^\//, "")}`)
      : current?.master_product.image_url || item.productImageUrl;
    const stock = current?.stock ?? 0;
    const quantityInvalid = !Number.isInteger(item.qty) || item.qty <= 0;
    const insufficientStock = Boolean(current && !unavailable && item.qty > stock);
    const issue = unavailable ? "Produk tidak tersedia di toko ini. Hapus untuk melanjutkan."
      : quantityInvalid ? "Jumlah produk tidak valid. Hapus lalu tambahkan kembali dari katalog."
      : insufficientStock ? `Stok saat ini ${stock}. Kurangi jumlah atau hapus produk.` : "";
    return {
      ...item,
      productName: name,
      productPrice: price,
      productStock: stock,
      tax_percentage: tax,
      unavailable,
      issue,
      product: { id: item.productId, name, price, image_url: image, category: current?.master_product.category ?? item.productCategory, stock, tax_percentage: tax },
      subtotal: price * item.qty,
    };
  });
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  return {
    items,
    total,
    totalItems: items.reduce((sum, item) => sum + item.qty, 0),
    unavailableItems: items.filter((item) => item.unavailable),
    isReady: catalog !== undefined && items.length > 0 && items.every((item) => !item.issue),
  };
}
