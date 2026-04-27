import { mockProducts } from "@/lib/mockData";

export interface CartItem {
  productId: string;
  qty: number;
  productName?: string;
  productPrice?: number;
  productImageUrl?: string;
  productCategory?: string;
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

export function addToCart(productId: string, qty = 1, productDetails?: { name: string; price: number; imageUrl?: string; category?: string }) {
  const cart = getCart();
  const existing = cart.find((item) => item.productId === productId);
  const next = existing
    ? cart.map((item) =>
      item.productId === productId ? { ...item, qty: item.qty + qty } : item
    )
    : [...cart, { productId, qty, productName: productDetails?.name, productPrice: productDetails?.price, productImageUrl: productDetails?.imageUrl, productCategory: productDetails?.category }];
  saveCart(next);
  return next;
}

export function updateCartQty(productId: string, qty: number) {
  const cart = getCart()
    .map((item) => (item.productId === productId ? { ...item, qty } : item))
    .filter((item) => item.qty > 0);
  saveCart(cart);
  return cart;
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
      return {
        ...item,
        product: {
          id: item.productId,
          name: item.productName,
          price: item.productPrice,
          image_url: item.productImageUrl,
          category: item.productCategory,
        },
        subtotal: item.productPrice * item.qty,
      };
    }

    // Fallback to looking up in products list (for backward compatibility)
    const product = products.find((p) => p.id === item.productId);
    if (!product) return null;
    return {
      ...item,
      product,
      subtotal: product.price * item.qty,
    };
  }).filter(Boolean) as Array<CartItem & { product: any; subtotal: number }>;

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  return { items, total, totalItems };
}
