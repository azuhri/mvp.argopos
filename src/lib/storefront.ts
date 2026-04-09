import { mockProducts } from "@/lib/mockData";

export interface CartItem {
  productId: string;
  qty: number;
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

export function addToCart(productId: string, qty = 1) {
  const cart = getCart();
  const existing = cart.find((item) => item.productId === productId);
  const next = existing
    ? cart.map((item) =>
        item.productId === productId ? { ...item, qty: item.qty + qty } : item
      )
    : [...cart, { productId, qty }];
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

export function getCartSummary() {
  const cart = getCart();
  const items = cart.map((item) => {
    const product = mockProducts.find((p) => p.id === item.productId);
    if (!product) return null;
    return {
      ...item,
      product,
      subtotal: product.price * item.qty,
    };
  }).filter(Boolean) as Array<CartItem & { product: typeof mockProducts[0]; subtotal: number }>;

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  return { items, total, totalItems };
}
