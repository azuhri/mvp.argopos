import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";
import MasterRoles from "./Roles";

const mocks = vi.hoisted(() => ({
  getAllRoles: vi.fn(), getAllMenus: vi.fn(), getRolePermissions: vi.fn(),
  setRolePermissions: vi.fn(), updateRole: vi.fn(),
  toastError: vi.fn(), refreshCallbacks: [] as Array<() => Promise<void>>,
}));
vi.mock("@/lib/services/accessRoleService", () => ({ accessRoleService: mocks }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/navigation", () => ({ NAV_GROUPS_MENUS: [{ listMenus: [{ key: "master_stores", label: "Store Management", icon: () => null }] }] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}><option value="">Choose role</option>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

function PermissionProbe() {
  const { canWrite, refreshPermissions, permissionsRefreshing } = useAuth();
  useEffect(() => { mocks.refreshCallbacks.push(refreshPermissions); }, [refreshPermissions]);
  return <>
    <output data-testid="store-access">{canWrite("master_stores") ? "write" : "hidden"}</output>
    <button disabled={permissionsRefreshing} onClick={() => void refreshPermissions()}>Refresh current access</button>
  </>;
}

const clients: QueryClient[] = [];
let serverPermissions: Record<string, { master_stores: "hidden" | "write" }>;

function renderSession({ cached = "hidden", showRoles = true, signedIn = true }: { cached?: "hidden" | "write"; showRoles?: boolean; signedIn?: boolean } = {}) {
  if (signedIn) localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "staff-one", role: "staff_internal", role_id: "staff-role" }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  client.setQueryData(["role-permissions", "staff-role"], { master_stores: cached });
  client.setQueryData(["role-permissions", "source-role"], { master_stores: "write" });
  render(<QueryClientProvider client={client}><AuthProvider><PermissionProbe />{showRoles && <MasterRoles />}</AuthProvider></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.refreshCallbacks.length = 0;
  const storedValues = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => { storedValues.set(key, String(value)); },
    removeItem: (key: string) => { storedValues.delete(key); },
    clear: () => storedValues.clear(),
    key: (index: number) => Array.from(storedValues.keys())[index] ?? null,
    get length() { return storedValues.size; },
  });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  serverPermissions = { "staff-role": { master_stores: "hidden" }, "source-role": { master_stores: "write" } };
  mocks.getAllRoles.mockResolvedValue([{ id: "staff-role", role_name: "staff_internal" }, { id: "source-role", role_name: "permission_source" }]);
  mocks.getAllMenus.mockResolvedValue([{ id: "store-menu", menu_name: "master_stores" }]);
  mocks.getRolePermissions.mockImplementation(async (roleId: string) => ({ ...serverPermissions[roleId] }));
  mocks.updateRole.mockResolvedValue({});
  mocks.setRolePermissions.mockImplementation(async (roleId: string, permissions: { master_stores: "hidden" | "write" }) => { serverPermissions[roleId] = { ...permissions }; });
});
afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("role permission cache synchronization", () => {
  it("refreshes the mounted AuthProvider after saving a grant while its hidden cache is still fresh", async () => {
    const client = renderSession();
    fireEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Write", { exact: true }));
    expect(screen.getByTestId("store-access")).toHaveTextContent("hidden");
    fireEvent.click(within(dialog).getByRole("button", { name: "Update" }));
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
    expect(mocks.setRolePermissions).toHaveBeenCalledWith("staff-role", { master_stores: "write" });
    expect(client.getQueryState(["role-permissions", "source-role"])?.isInvalidated).toBe(false);
  });

  it("does not grant access or invalidate cached permissions when saving fails", async () => {
    const client = renderSession();
    mocks.setRolePermissions.mockRejectedValue(new Error("save failed"));
    fireEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Write", { exact: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Update" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("save failed"));
    expect(screen.getByTestId("store-access")).toHaveTextContent("hidden");
    expect(client.getQueryData(["role-permissions", "staff-role"])).toEqual({ master_stores: "hidden" });
    expect(client.getQueryState(["role-permissions", "staff-role"])?.isInvalidated).toBe(false);
  });

  it("removes a cached write grant after successfully resetting that role", async () => {
    serverPermissions["staff-role"] = { master_stores: "write" };
    renderSession({ cached: "write" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
    fireEvent.click((await screen.findAllByRole("button", { name: "Reset" }))[0]);
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("hidden"));
    expect(mocks.setRolePermissions).toHaveBeenCalledWith("staff-role", { master_stores: "hidden" });
  });

  it("refreshes the target role rather than the source after copying permissions", async () => {
    const client = renderSession();
    await screen.findByRole("heading", { name: "staff_internal" });
    fireEvent.click(screen.getByRole("button", { name: "Copy Permissions" }));
    const dialog = screen.getByRole("dialog");
    const selects = within(dialog).getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "source-role" } });
    fireEvent.change(selects[1], { target: { value: "staff-role" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
    expect(mocks.setRolePermissions).toHaveBeenCalledWith("staff-role", { master_stores: "write" });
    expect(client.getQueryState(["role-permissions", "source-role"])?.isInvalidated).toBe(false);
  });

  it("explicitly refreshes a still-fresh cache and keeps the refresh callback stable", async () => {
    renderSession({ showRoles: false });
    await waitFor(() => expect(mocks.refreshCallbacks).toHaveLength(2));
    expect(mocks.getRolePermissions).not.toHaveBeenCalled();
    serverPermissions["staff-role"] = { master_stores: "write" };
    fireEvent.click(screen.getByRole("button", { name: "Refresh current access" }));
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
    expect(mocks.getRolePermissions).toHaveBeenCalledWith("staff-role");
    expect(mocks.refreshCallbacks).toHaveLength(2);
  });

  it("keeps access denied when the explicit permission refresh fails", async () => {
    renderSession({ showRoles: false });
    await waitFor(() => expect(mocks.refreshCallbacks).toHaveLength(2));
    mocks.getRolePermissions.mockRejectedValue(new Error("unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh current access" }));
    await waitFor(() => expect(mocks.getRolePermissions).toHaveBeenCalledWith("staff-role"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh current access" })).toBeEnabled());
    expect(screen.getByTestId("store-access")).toHaveTextContent("hidden");
  });

  it("does not fetch permissions without a signed-in role", async () => {
    renderSession({ showRoles: false, signedIn: false });
    fireEvent.click(screen.getByRole("button", { name: "Refresh current access" }));
    expect(mocks.getRolePermissions).not.toHaveBeenCalled();
    expect(screen.getByTestId("store-access")).toHaveTextContent("hidden");
  });
});
