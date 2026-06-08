import { mockProducts } from "@/lib/mockData";

export interface CartItem {
  productId: string;
  qty: number;
  productName?: string;
  productPrice?: number;
  productImageUrl?: string;
  productCategory?: string;
  productStock?: number;
  productStockId?: string;
  tax_percentage?: number;
}

interface AddToCartResult {
  success: boolean;
  message: string;
  cart?: CartItem[];
}

const CART_KEY = "argopos.store.cart";

export function getCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart(
  productId: string,
  qty = 1,
  productDetails?: { name: string; price: number; imageUrl?: string; category?: string; tax_percentage?: number },
  productStock: number = 999999
): AddToCartResult {
  const cart = getCart();
  const existing = cart.find((item) => item.productId === productId);
  const currentQty = existing ? existing.qty : 0;
  const requestedQty = currentQty + qty;

  // Get the stock limit - use stored stock if available, otherwise use passed stock
  const maxStock = existing?.productStock ?? productStock;

  // Check if requested quantity exceeds stock
  if (requestedQty > maxStock) {
    return {
      success: false,
      message: `Stok tidak mencukupi. Maksimal ${maxStock} item.`,
      cart,
    };
  }

  const next = existing
    ? cart.map((item) =>
      item.productId === productId ? { ...item, qty: item.qty + qty } : item
    )
    : [...cart, {
      productId,
      qty,
      productName: productDetails?.name,
      productPrice: productDetails?.price,
      productImageUrl: productDetails?.imageUrl,
      productCategory: productDetails?.category,
      productStock: productStock,
      productStockId: productId,
      tax_percentage: productDetails?.tax_percentage,
    }];
  saveCart(next);
  return { success: true, message: "Produk ditambahkan ke keranjang", cart: next };
}

export function updateCartQty(productId: string, newQty: number) {
  const cart = getCart();
  const existing = cart.find((item) => item.productId === productId);

  if (!existing) {
    return { success: false, message: "Produk tidak ditemukan di keranjang", cart };
  }

  // Get stock from stored item
  const maxStock = existing.productStock ?? 999999;

  // Validate stock
  if (newQty > maxStock) {
    return { success: false, message: `Stok tidak mencukupi. Maksimal ${maxStock} item.`, cart };
  }

  const next = cart
    .map((item) => {
      if (item.productId === productId) {
        return { ...item, qty: newQty };
      }
      return item;
    })
    .filter((item) => item.qty > 0);
  saveCart(next);
  return { success: true, message: "OK", cart };
}

export function removeFromCart(productId: string) {
  const cart = getCart().filter((item) => item.productId !== productId);
  saveCart(cart);
  return cart;
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
}

export function getCartSummary(products: any[] = mockProducts) {
  const cart = getCart();

  const items = cart.map((item) => {
    // Use stored product details if available
    if (item.productName && item.productPrice) {
      // Calculate base subtotal (before tax)
      const baseSubtotal = item.productPrice * item.qty;
      // Calculate tax amount
      const taxAmount = item.tax_percentage ? (item.productPrice * item.tax_percentage / 100) * item.qty : 0;
      // Calculate final subtotal (after tax)
      const finalSubtotal = baseSubtotal; //+ taxAmount;

      return {
        ...item,
        product: {
          id: item.productId,
          name: item.productName,
          price: item.productPrice,
          image_url: item.productImageUrl,
          category: item.productCategory,
          stock: item.productStock,
          tax_percentage: item.tax_percentage,
        },
        subtotal: baseSubtotal,
        final_subtotal: finalSubtotal,
      };
    }

    // Fallback to looking up in products list (for backward compatibility)
    const product = products.find((p) => p.id === item.productId);
    if (!product) return null;

    const baseSubtotal = product.price * item.qty;
    const taxPercentage = product.tax_percentage || 0;
    // const taxAmount = taxPercentage ? (product.price * taxPercentage / 100) * item.qty : 0;
    const finalSubtotal = baseSubtotal;// + taxAmount;

    return {
      ...item,
      product,
      subtotal: baseSubtotal,
      // tax_amount: taxAmount,
      final_subtotal: finalSubtotal,
    };
  }).filter(Boolean) as Array<CartItem & { product: any; subtotal: number; tax_amount: number; final_subtotal: number }>;

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
  const total = subtotal; //+ totalTax; // Total includes tax
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  return { items, subtotal, totalTax, total, totalItems };
}

// Helper function to update stock in cart items (for sync with store data)
export function updateCartStock(productId: string, newStock: number) {
  const cart = getCart();
  const next = cart.map((item) => {
    if (item.productId === productId) {
      return { ...item, productStock: newStock };
    }
    return item;
  });
  saveCart(next);
  return next;
}
