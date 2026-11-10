import { clearCart, getCart } from "@/lib/storefront";

export const COMMERCE_LOCATION_CONFIRMATION_KEY = "argopos.commerce.location-confirmed.v1";
export const COMMERCE_LOCATION_PREFERENCE_KEY = "selectedLocationCode";
export const COMMERCE_LOCATION_CHANGE_EVENT = "commerce-location-change";

let memoryConfirmation = "";
let confirmationStorageUnavailable = false;
let confirmationFallbackBaseline: string | null = null;

export function getConfirmedCommerceLocation(): string {
  if (confirmationStorageUnavailable) {
    try {
      const current = sessionStorage.getItem(COMMERCE_LOCATION_CONFIRMATION_KEY);
      if (current !== confirmationFallbackBaseline) { confirmationStorageUnavailable = false; return current || ""; }
    } catch { /* Storage remains unavailable. */ }
    return memoryConfirmation;
  }
  try { return sessionStorage.getItem(COMMERCE_LOCATION_CONFIRMATION_KEY) || ""; }
  catch { return memoryConfirmation; }
}

export function getPreferredCommerceLocation(): string {
  try { return localStorage.getItem(COMMERCE_LOCATION_PREFERENCE_KEY) || ""; }
  catch { return ""; }
}

export function hasCommerceCart(): boolean {
  try { const cart = getCart(); return Array.isArray(cart) && cart.length > 0; }
  catch { return false; }
}

export function commerceCartNeedsReset(locationCode: string): boolean {
  return hasCommerceCart() && getPreferredCommerceLocation() !== locationCode;
}

// Call only after an explicit confirmation and a fresh active-store lookup.
// The previous preference identifies the shared cart's location; it never
// substitutes for this tab's explicit selection.
export function confirmCommerceLocation(locationCode: string) {
  const resetCart = commerceCartNeedsReset(locationCode);
  let previous: string | null;
  try {
    previous = localStorage.getItem(COMMERCE_LOCATION_PREFERENCE_KEY);
    // The owner must remain shared between tabs. A memory-only preference would
    // let another tab keep writing products from the previous store.
    if (previous !== locationCode) localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, locationCode);
    if (localStorage.getItem(COMMERCE_LOCATION_PREFERENCE_KEY) !== locationCode) throw new Error("Owner not saved");
  } catch {
    throw new Error("Lokasi belum dapat disimpan di browser. Izinkan penyimpanan situs lalu coba kembali.");
  }
  try { if (resetCart) clearCart(); }
  catch {
    try {
      if (previous === null) localStorage.removeItem(COMMERCE_LOCATION_PREFERENCE_KEY);
      else localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, previous);
    } catch { /* A mismatched shared owner keeps the gate closed. */ }
    throw new Error("Keranjang belum dapat diperbarui. Pilihan lokasi belum dikonfirmasi; coba kembali.");
  }
  memoryConfirmation = locationCode;
  try { confirmationFallbackBaseline = sessionStorage.getItem(COMMERCE_LOCATION_CONFIRMATION_KEY); } catch { confirmationFallbackBaseline = null; }
  try { sessionStorage.setItem(COMMERCE_LOCATION_CONFIRMATION_KEY, locationCode); confirmationStorageUnavailable = false; }
  catch { confirmationStorageUnavailable = true; }
  window.dispatchEvent(new Event(COMMERCE_LOCATION_CHANGE_EVENT));
  window.dispatchEvent(new Event("storage"));
}

export function commerceDestination(pathname: string, locationCode: string, previousCode: string, selectedCode: string): string {
  const catalog = `/${encodeURIComponent(selectedCode)}/commerce`;
  if (pathname === "/commerce/locations") return catalog;
  if (locationCode && selectedCode === locationCode) return pathname;
  if (!locationCode && selectedCode === previousCode && pathname.startsWith("/commerce/")) {
    return catalog + pathname.slice("/commerce".length);
  }
  return catalog;
}
