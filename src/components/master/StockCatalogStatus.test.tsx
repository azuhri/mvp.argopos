import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
import { StockCatalogAccessInfo, StockCatalogStatus } from "./StockCatalogStatus";

const auth = vi.hoisted(() => ({ role: "staff_internal", write: true, refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({
  user: { id: "staff-1", role: auth.role }, canWrite: () => auth.write, loading: false,
  refreshPermissions: auth.refresh, permissionsRefreshing: false,
}) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function Harness({ assigned = true }: { assigned?: boolean }) {
  const [status, setStatus] = useState(true);
  return <StockCatalogStatus stockId="stock-1" productName="Sosis" status={status}
    assignedUserIds={assigned ? ["staff-1"] : []} locationCode="TEST" onSaved={setStatus} />;
}
function mount(assigned = true) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Harness assigned={assigned} /></QueryClientProvider>);
  return client;
}
beforeEach(() => { auth.write = true; auth.role = "staff_internal"; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("catalog stock status", () => {
  it("persists false and true and invalidates the public catalog", async () => {
    const save = vi.spyOn(apiClient, "setStockStatus").mockImplementation(async (id, status) => ({ success: true, data: { id, status } }));
    const client = mount();
    client.setQueryData(["store", "TEST"], { product_stores: [] });
    const toggle = screen.getByRole("switch", { name: "Status katalog Sosis" });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(save).toHaveBeenLastCalledWith("stock-1", false);
    expect(client.getQueryState(["store", "TEST"])?.isInvalidated).toBe(true);
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(save).toHaveBeenLastCalledWith("stock-1", true);
  });

  it("keeps the previous status when saving fails", async () => {
    vi.spyOn(apiClient, "setStockStatus").mockRejectedValue(new Error("offline"));
    mount();
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toggle).toBeChecked();
    await waitFor(() => expect(toggle).toBeEnabled());
  });

  it.each(["read-only", "unassigned"])("disables updates for %s staff", (scenario) => {
    const save = vi.spyOn(apiClient, "setStockStatus");
    auth.write = scenario !== "read-only";
    mount(scenario !== "unassigned");
    expect(screen.getByRole("switch")).toBeDisabled();
    fireEvent.click(screen.getByRole("switch"));
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps super admin locked until the explicit Store Management grant is refreshed", async () => {
    auth.role = "super_admin";
    auth.write = false;
    const refreshStore = vi.fn().mockResolvedValue(undefined);
    const client = new QueryClient();
    const tree = () => <QueryClientProvider client={client}>
      <StockCatalogAccessInfo assignedUserIds={[]} onRefresh={refreshStore} />
      <Harness assigned={false} />
    </QueryClientProvider>;
    const { rerender } = render(tree());
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByText(/akses Write pada Store Management/)).toBeVisible();
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    auth.refresh.mockImplementationOnce(async () => { auth.write = true; });
    fireEvent.click(screen.getByRole("button", { name: "Periksa ulang akses" }));
    await waitFor(() => expect(refreshStore).toHaveBeenCalledTimes(1));
    rerender(tree());
    expect(screen.getByRole("switch")).toBeEnabled();
    expect(screen.queryByText(/akses Write pada Store Management/)).not.toBeInTheDocument();
  });

  it("explains that store assignment is missing without granting access", () => {
    render(<StockCatalogAccessInfo assignedUserIds={[]} onRefresh={vi.fn()} />);
    expect(screen.getByText(/belum ditugaskan ke toko ini/)).toBeVisible();
  });
});
