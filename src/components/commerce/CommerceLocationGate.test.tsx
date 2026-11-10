import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommerceLocationGate } from "./CommerceLocationGate";
import { locationService } from "@/lib/services/locationService";
import { COMMERCE_LOCATION_CONFIRMATION_KEY, COMMERCE_LOCATION_PREFERENCE_KEY } from "@/lib/commerceLocation";

vi.mock("@/components/commerce/PendingPaymentSection", () => ({ PendingPaymentSection: () => <div>Pesanan tersimpan</div> }));
vi.mock("@/components/shared/ThemeToggle", () => ({ ThemeToggle: () => null }));
const stores = [
  { id: "a", location_code: "A", location_name: "Outlet Alpha", type: "store" as const, status: "active", created_at: "2026-11-05" },
  { id: "b", location_code: "B", location_name: "Outlet Beta", type: "store" as const, status: "active", created_at: "2026-11-05" },
];
const cart = [{ productId: "a-stock", productStockId: "a-stock", qty: 2, productName: "Produk A", productPrice: 12000 }];
const cartJSON = JSON.stringify(cart);

function Shopping() {
  const location = useLocation();
  return <><p>Shopping {location.pathname}</p><Link to="/B/commerce">Other store link</Link></>;
}
function mount(path = "/commerce") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/commerce" element={<CommerceLocationGate />} />
    <Route path="/commerce/cart" element={<CommerceLocationGate />} />
    <Route path="/commerce/product/:productId" element={<CommerceLocationGate />} />
    <Route path="/commerce/locations" element={<CommerceLocationGate forceSelection />} />
    <Route path="/:locationCode/commerce" element={<CommerceLocationGate><Shopping /></CommerceLocationGate>} />
    <Route path="/:locationCode/commerce/cart" element={<CommerceLocationGate><Shopping /></CommerceLocationGate>} />
    <Route path="/:locationCode/commerce/product/:productId" element={<CommerceLocationGate><Shopping /></CommerceLocationGate>} />
    <Route path="/:locationCode/commerce/payment/:transactionId" element={<p>Historical payment</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
  return client;
}
async function confirm() { fireEvent.click(await screen.findByRole("button", { name: "Lanjutkan belanja" })); }
function seedSelection(code = "A") { localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, code); sessionStorage.setItem(COMMERCE_LOCATION_CONFIRMATION_KEY, code); }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(locationService, "getListStore").mockResolvedValue(stores); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("commerce location selection gate", () => {
  it("requires an explicit selection despite a remembered active location, hides inactive stores and preserves pending recovery", async () => {
    localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, "B");
    vi.mocked(locationService.getListStore).mockResolvedValue([...stores, { ...stores[0], id: "off", location_code: "OFF", location_name: "Disabled store", status: "inactive" }]);
    mount();
    expect(await screen.findByRole("radio", { name: "Outlet Beta" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Disabled store" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Shopping/)).not.toBeInTheDocument();
    expect(screen.getByText("Pesanan tersimpan")).toBeInTheDocument();
    expect(sessionStorage.getItem(COMMERCE_LOCATION_CONFIRMATION_KEY)).toBeNull();
    await confirm();
    expect(await screen.findByText("Shopping /B/commerce")).toBeInTheDocument();
    expect(sessionStorage.getItem(COMMERCE_LOCATION_CONFIRMATION_KEY)).toBe("B");
    expect(locationService.getListStore).toHaveBeenCalledTimes(2);
  });
  it("still asks with one active store and defaults a matching URL over saved location", async () => {
    localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, "B");
    vi.mocked(locationService.getListStore).mockResolvedValue([stores[0]]);
    mount("/A/commerce/cart");
    expect(await screen.findByRole("radio", { name: "Outlet Alpha" })).toBeChecked();
    expect(screen.queryByText(/^Shopping/)).not.toBeInTheDocument();
    await confirm();
    expect(await screen.findByText("Shopping /A/commerce/cart")).toBeInTheDocument();
  });
  it("keeps same-store cart and confirmed catalog links, but asks again for a different scoped URL", async () => {
    seedSelection(); localStorage.setItem("argopos.store.cart", cartJSON);
    mount("/A/commerce");
    expect(await screen.findByText("Shopping /A/commerce")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Other store link" }));
    expect(await screen.findByRole("heading", { name: "Pilih lokasi belanja" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Outlet Beta" })).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Mengganti lokasi akan mengosongkan keranjang");
    expect(localStorage.getItem("argopos.store.cart")).toBe(cartJSON);
    localStorage.setItem("argopos.store.pending-payments.v1", "keep-history");
    await confirm();
    expect(await screen.findByText("Shopping /B/commerce")).toBeInTheDocument();
    expect(localStorage.getItem("argopos.store.cart")).toBeNull();
    expect(localStorage.getItem("argopos.store.pending-payments.v1")).toBe("keep-history");
  });
  it("preserves same-location cart on first explicit confirmation", async () => {
    localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, "A"); localStorage.setItem("argopos.store.cart", cartJSON);
    mount("/A/commerce/cart"); await confirm();
    expect(await screen.findByText("Shopping /A/commerce/cart")).toBeInTheDocument();
    expect(localStorage.getItem("argopos.store.cart")).toBe(cartJSON);
  });
  it("a location disabled between display and confirmation cannot enter or clear cart", async () => {
    localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, "A"); localStorage.setItem("argopos.store.cart", cartJSON);
    vi.mocked(locationService.getListStore).mockResolvedValueOnce(stores).mockResolvedValue([stores[0]]);
    mount("/B/commerce"); await confirm();
    expect(await screen.findByText("Lokasi yang dipilih sudah tidak tersedia. Pilih lokasi aktif lainnya.")).toBeInTheDocument();
    expect(screen.queryByText(/^Shopping/)).not.toBeInTheDocument();
    expect(localStorage.getItem("argopos.store.cart")).toBe(cartJSON);
    expect(sessionStorage.getItem(COMMERCE_LOCATION_CONFIRMATION_KEY)).toBeNull();
  });
  it("blocks cached confirmation when active-list load fails, then recovers on explicit retry", async () => {
    seedSelection(); vi.mocked(locationService.getListStore).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(stores);
    mount("/A/commerce");
    expect(await screen.findByRole("alert")).toHaveTextContent("Daftar lokasi belum dapat dimuat");
    expect(screen.queryByText(/^Shopping/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang lokasi" }));
    expect(await screen.findByText("Shopping /A/commerce")).toBeInTheDocument();
  });
  it("shows an empty state without any checkout action when all locations are inactive", async () => {
    vi.mocked(locationService.getListStore).mockResolvedValue([]); mount();
    expect(await screen.findByText("Belum ada lokasi aktif")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lanjutkan belanja" })).not.toBeInTheDocument();
  });
  it("cross-tab location changes unmount shopping and require reconfirmation", async () => {
    seedSelection(); mount("/A/commerce");
    expect(await screen.findByText("Shopping /A/commerce")).toBeInTheDocument();
    localStorage.setItem(COMMERCE_LOCATION_PREFERENCE_KEY, "B");
    fireEvent(window, new StorageEvent("storage", { key: COMMERCE_LOCATION_PREFERENCE_KEY, newValue: "B" }));
    expect(await screen.findByRole("heading", { name: "Pilih lokasi belanja" })).toBeInTheDocument();
    expect(screen.queryByText(/^Shopping/)).not.toBeInTheDocument();
  });
  it("location picker always asks, with a non-mutating way to return to the current store", async () => {
    seedSelection(); localStorage.setItem("argopos.store.cart", cartJSON); mount("/commerce/locations?location=B");
    expect(await screen.findByRole("radio", { name: "Outlet Beta" })).toBeChecked();
    fireEvent.click(screen.getByRole("link", { name: "Kembali ke katalog" }));
    expect(await screen.findByText("Shopping /A/commerce")).toBeInTheDocument();
    expect(localStorage.getItem("argopos.store.cart")).toBe(cartJSON);
  });
  it("legacy cart links retain their destination for the same confirmed cart location", async () => {
    seedSelection(); mount("/commerce/cart");
    expect(await screen.findByText("Shopping /A/commerce/cart")).toBeInTheDocument();
  });
  it("choosing a different location from a product deep link enters that catalog instead", async () => {
    mount("/A/commerce/product/a-stock");
    fireEvent.click(await screen.findByRole("radio", { name: "Outlet Beta" })); await confirm();
    expect(await screen.findByText("Shopping /B/commerce")).toBeInTheDocument();
  });
  it("historical payment links do not require a new shopping location", () => {
    mount("/OFF/commerce/payment/old-order");
    expect(screen.getByText("Historical payment")).toBeInTheDocument();
    expect(locationService.getListStore).not.toHaveBeenCalled();
  });
});
