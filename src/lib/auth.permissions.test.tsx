import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth, type PermissionMode } from "./auth";
import { notifyRolePermissionsChanged } from "./permissionEvents";

const mocks = vi.hoisted(() => ({ getRolePermissions: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("./services/accessRoleService", () => ({ accessRoleService: mocks }));
vi.mock("./services/userService", () => ({ userService: mocks }));

const profile = {
  id: "user-one", username: "admin", email: "admin@example.test", role_id: "role-one",
  role: { id: "role-one", role_name: "super_admin" }, created_at: "2026-01-01", updated_at: "2026-01-01",
};
let permissions: Record<string, Record<string, PermissionMode>>;
const clients: QueryClient[] = [];

function Probe() {
  const { user, loading, getPermission, canRead, canWrite, logout } = useAuth();
  return <>
    <output data-testid="role">{user?.role ?? "signed-out"}</output>
    <output data-testid="ready">{loading ? "loading" : "ready"}</output>
    <output data-testid="access">{getPermission("master_roles")}</output>
    <output data-testid="read">{String(canRead("master_roles"))}</output>
    <button disabled={!canWrite("master_roles")}>Edit role</button>
    <button onClick={logout}>Logout</button>
  </>;
}

function renderSession(signedIn = true) {
  if (signedIn) {
    localStorage.setItem("argopos.auth.token", "test-session");
    localStorage.setItem("argopos.auth.user", JSON.stringify({ ...profile, role: profile.role.role_name }));
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  const storedValues = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => { storedValues.set(key, String(value)); },
    removeItem: (key: string) => { storedValues.delete(key); },
    clear: () => storedValues.clear(),
  });
  permissions = { "role-one": { master_roles: "write" }, "role-two": { master_roles: "read" } };
  mocks.getCurrentUser.mockResolvedValue(profile);
  mocks.getRolePermissions.mockImplementation(async (roleId: string) => ({ ...permissions[roleId] }));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("canonical session permissions", () => {
  it("honors read and hidden settings even for the super_admin role name", async () => {
    permissions["role-one"].master_roles = "read";
    renderSession();
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("ready"));
    expect(screen.getByTestId("read")).toHaveTextContent("true");
    expect(screen.getByRole("button", { name: "Edit role" })).toBeDisabled();

    permissions["role-one"].master_roles = "hidden";
    act(() => notifyRolePermissionsChanged("role-one"));
    await waitFor(() => expect(screen.getByTestId("read")).toHaveTextContent("false"));
  });

  it("refreshes only the edited role and preserves the source role cache", async () => {
    permissions["role-one"].master_roles = "hidden";
    const client = renderSession();
    client.setQueryData(["role-permissions", "role-two"], { master_roles: "write" });
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("ready"));
    permissions["role-one"].master_roles = "write";
    act(() => notifyRolePermissionsChanged("role-one"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    expect(client.getQueryState(["role-permissions", "role-two"])?.isInvalidated).toBe(false);
    expect(mocks.getRolePermissions).toHaveBeenCalledTimes(2);
  });

  it("receives revocation from another browser tab", async () => {
    renderSession();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    permissions["role-one"].master_roles = "hidden";
    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: "celestia.role-permissions.changed", newValue: JSON.stringify({ roleId: "role-one", nonce: "another-tab" }),
    })));
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("hidden"));
  });

  it("refreshes on window focus even while permissions are still fresh", async () => {
    renderSession();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    permissions["role-one"].master_roles = "hidden";
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("hidden"));
  });

  it("refreshes an open session every 30 seconds after another administrator revokes access", async () => {
    vi.useFakeTimers();
    renderSession();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled();
    permissions["role-one"].master_roles = "hidden";
    await act(async () => { await vi.advanceTimersByTimeAsync(30_010); });
    expect(mocks.getRolePermissions).toHaveBeenCalledTimes(2);
    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Edit role" })).toBeDisabled();
  });

  it("revokes permissions on a failed refresh instead of keeping cached write access", async () => {
    renderSession();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    mocks.getRolePermissions.mockRejectedValue(new Error("permissions unavailable"));
    act(() => notifyRolePermissionsChanged("role-one"));
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("hidden"));
    expect(screen.getByRole("button", { name: "Edit role" })).toBeDisabled();
  });

  it("uses a server-side role reassignment and accepts custom role names", async () => {
    const client = renderSession();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    mocks.getCurrentUser.mockResolvedValue({ ...profile, role_id: "role-two", role: { id: "role-two", role_name: "finance_readonly" } });
    await act(async () => { await client.invalidateQueries({ queryKey: ["current-user"] }); });
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("read"));
    expect(screen.getByTestId("role")).toHaveTextContent("finance_readonly");
    expect(screen.getByRole("button", { name: "Edit role" })).toBeDisabled();
    expect(JSON.parse(localStorage.getItem("argopos.auth.user")!).role_id).toBe("role-two");
  });

  it("denies cached grants if the authenticated user can no longer be verified", async () => {
    const client = renderSession();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    mocks.getCurrentUser.mockRejectedValue(new Error("session unavailable"));
    await act(async () => { await client.invalidateQueries({ queryKey: ["current-user"] }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeDisabled());
  });

  it("clears cached permissions at logout", async () => {
    const client = renderSession();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit role" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(screen.getByTestId("role")).toHaveTextContent("signed-out");
    expect(screen.getByRole("button", { name: "Edit role" })).toBeDisabled();
    expect(client.getQueryData(["role-permissions", "role-one"])).toBeUndefined();
    expect(client.getQueryData(["current-user"])).toBeUndefined();
  });

  it("does not fetch profile or permissions for a signed-out visitor", () => {
    renderSession(false);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.getRolePermissions).not.toHaveBeenCalled();
    expect(screen.getByTestId("access")).toHaveTextContent("hidden");
  });
});
