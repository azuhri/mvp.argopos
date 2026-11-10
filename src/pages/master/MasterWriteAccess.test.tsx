import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsersManagement from "./UsersManagement";
import Products from "./Products";
import Locations from "./Locations";
import Stocks from "./Stocks";

const mocks = vi.hoisted(() => ({
  writable: new Set<string>(), role: "catalog_operator", createLocation: vi.fn(),
  getLocations: vi.fn(), getProducts: vi.fn(), getUsers: vi.fn(), getStocks: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "operator", role: mocks.role }, loading: false, canWrite: (key: string) => mocks.writable.has(key) }) }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ui/MapPicker", () => ({ default: () => null, MapPicker: () => null }));
vi.mock("@/lib/services/locationService", () => ({ locationService: { getLocations: mocks.getLocations, createLocation: mocks.createLocation } }));
vi.mock("@/lib/services/productService", () => ({ productService: { getProducts: mocks.getProducts, getAllProducts: async () => [] } }));
vi.mock("@/lib/services/userService", () => ({ userService: { getUsers: mocks.getUsers, getRoles: async () => [] } }));
vi.mock("@/lib/services/stockService", () => ({ stockService: { getStocks: mocks.getStocks } }));

const clients: QueryClient[] = [];
function mount(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
  return render(element, { wrapper });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.writable.clear(); mocks.role = "catalog_operator";
  mocks.getLocations.mockResolvedValue({ locations: [], meta: { page: 1, page_size: 10, total: 0 } });
  mocks.getProducts.mockResolvedValue({ products: [], meta: { page: 1, page_size: 10, total: 0 } });
  mocks.getUsers.mockResolvedValue({ users: [], meta: { page: 1, page_size: 20, total: 0 } });
  mocks.getStocks.mockResolvedValue({ location_groups: [], meta: { page: 1, page_size: 10, total: 0 } });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe("master CRUD write permissions", () => {
  it.each([
    { name: "users", element: <UsersManagement />, button: "Add User" },
    { name: "products", element: <Products />, button: "Add Product" },
    { name: "locations", element: <Locations />, button: "Tambah Lokasi" },
    { name: "stocks", element: <Stocks />, button: "Create" },
  ])("keeps $name visible while disabling creation for Read", async ({ element, button }) => {
    mount(element);
    const action = await screen.findByRole("button", { name: button });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("enables user creation for a custom role with master_users write", async () => {
    mocks.writable.add("master_users");
    mount(<UsersManagement />);
    const action = await screen.findByRole("button", { name: "Add User" });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("disables an already-open location save after permission is revoked", async () => {
    mocks.writable.add("master_locations");
    const view = mount(<Locations />);
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Lokasi" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    mocks.writable.clear();
    view.rerender(<Locations />);
    const save = screen.getByRole("button", { name: /Create Location|Simpan|Tambah Lokasi/ });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(mocks.createLocation).not.toHaveBeenCalled());
  });

  it("keeps stock movement restricted by its own menu and operational role", async () => {
    mocks.writable.add("master_stock");
    mocks.writable.add("master_stock_mutations");
    mount(<Stocks />);
    expect(await screen.findByRole("button", { name: "Create" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Distribute" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
  });
});
