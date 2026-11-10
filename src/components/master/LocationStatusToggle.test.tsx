import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, type LocationListResponse } from "@/lib/api";
import { LocationStatusToggle } from "./LocationStatusToggle";

const auth = vi.hoisted(() => ({ role: "super_admin", write: true }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { role: auth.role }, canWrite: () => auth.write, loading: false }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const location = { id: "location-1", location_code: "TEST", location_name: "Toko Test", type: "store" as const, status: "active", created_at: "2026-11-05T00:00:00Z" };
const data: LocationListResponse = { locations: [location], meta: { page: 1, page_size: 10, total: 1 } };

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Harness() {
    const query = useQuery({ queryKey: ["locations", 1], initialData: data, staleTime: Infinity,
      queryFn: async () => client.getQueryData<LocationListResponse>(["locations", 1])! });
    return <LocationStatusToggle location={query.data.locations[0]} />;
  }
  render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  return client;
}
beforeEach(() => { auth.role = "super_admin"; auth.write = true; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("location status toggle", () => {
  it("saves off/on without submitting other fields and invalidates commerce caches", async () => {
    const update = vi.spyOn(apiClient, "updateLocation").mockImplementation(async (_id, changes) => ({ success: true, data: { ...location, ...changes } }));
    const client = mount();
    client.setQueryData(["stores"], [location]);
    client.setQueryData(["store", "TEST"], {});
    const toggle = screen.getByRole("switch", { name: "Status lokasi Toko Test" });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(update).toHaveBeenLastCalledWith(location.id, { status: "inactive", is_active: false });
    expect(client.getQueryState(["stores"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["store", "TEST"])?.isInvalidated).toBe(true);
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(update).toHaveBeenLastCalledWith(location.id, { status: "active", is_active: true });
  });
  it("retains the previous state and allows retry on API failure", async () => {
    vi.spyOn(apiClient, "updateLocation").mockRejectedValue(new Error("offline"));
    mount();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("switch")).toBeChecked();
    await waitFor(() => expect(screen.getByRole("switch")).toBeEnabled());
  });
  it.each(["super_admin", "staff_internal", "location_operator"])("disables the toggle for read-only %s", role => {
    auth.write = false; auth.role = role;
    const update = vi.spyOn(apiClient, "updateLocation");
    mount();
    expect(screen.getByRole("switch")).toBeDisabled();
    fireEvent.click(screen.getByRole("switch"));
    expect(update).not.toHaveBeenCalled();
  });
  it.each(["staff_internal", "location_operator"])("permits a configured write grant for %s", async role => {
    auth.role = role;
    const update = vi.spyOn(apiClient, "updateLocation").mockResolvedValue({ success: true, data: { ...location, status: "inactive", is_active: false } });
    mount();
    expect(screen.getByRole("switch")).toBeEnabled();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(update).toHaveBeenCalledWith(location.id, { status: "inactive", is_active: false }));
  });
});
