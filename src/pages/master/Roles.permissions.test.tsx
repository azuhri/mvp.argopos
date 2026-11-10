import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";
import type { Menu, Role, RoleSaveRequest } from "@/lib/api";
import { matrixPayload, roleMatrix, type PermissionMatrix } from "@/lib/services/roleManagementService";
import MasterRoles from "./Roles";

const mocks = vi.hoisted(() => ({
  list: vi.fn(), menus: vi.fn(), get: vi.fn(), save: vi.fn(), replacePermissions: vi.fn(), remove: vi.fn(),
  getRolePermissions: vi.fn(), getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/services/roleManagementService", async importOriginal => ({
  ...await importOriginal<object>(), roleManagementService: mocks,
}));
vi.mock("@/lib/services/accessRoleService", () => ({ accessRoleService: mocks }));
vi.mock("@/lib/services/userService", () => ({ userService: mocks }));
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const menus: Menu[] = [{ id: "roles-menu", menu_name: "master_roles" }, { id: "stores-menu", menu_name: "master_stores" }];
const profile = { id: "staff-one", username: "staff", email: "staff@example.test", role_id: "staff-role", role: { role_name: "staff_internal" }, created_at: "", updated_at: "" };
const clients: QueryClient[] = [];
let roles: Role[];
function setGrants(id: string, matrix: PermissionMatrix) {
  const role = roles.find(role => role.id === id)!;
  role.access_roles = matrixPayload(menus, matrix).map(grant => ({ ...grant, role_id: id, id: grant.menu_id, created_at: "", updated_at: "" }));
}
function PermissionProbe() {
  const { canWrite } = useAuth();
  return <output data-testid="store-access">{canWrite("master_stores") ? "write" : "hidden"}</output>;
}
function renderSession(path = "/master/roles/staff-role/edit") {
  localStorage.setItem("argopos.auth.user", JSON.stringify({ ...profile, role: "staff_internal" }));
  localStorage.setItem("argopos.auth.token", "fixture");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  client.setQueryData(["role-permissions", "source-role"], { master_stores: "write" });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><AuthProvider><PermissionProbe /><Routes>
    <Route path="/master/roles" element={<MasterRoles />} />
    <Route path="/master/roles/:roleId/edit" element={<MasterRoles mode="edit" />} />
    <Route path="/master/roles/:roleId" element={<MasterRoles mode="view" />} />
  </Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  roles = [
    { id: "staff-role", role_name: "staff_internal", description: "Operational", user_count: 1, name_locked: true, deletable: false, created_at: "", updated_at: "" },
    { id: "source-role", role_name: "source", description: "Template", user_count: 0, name_locked: false, deletable: true, created_at: "", updated_at: "" },
  ];
  setGrants("staff-role", { "roles-menu": "write", "stores-menu": "hidden" });
  setGrants("source-role", { "roles-menu": "write", "stores-menu": "write" });
  mocks.list.mockImplementation(async () => structuredClone(roles));
  mocks.menus.mockResolvedValue(menus);
  mocks.get.mockImplementation(async (id: string) => structuredClone(roles.find(role => role.id === id)));
  mocks.getCurrentUser.mockResolvedValue(profile);
  mocks.getRolePermissions.mockImplementation(async (id: string) => {
    const matrix = roleMatrix(roles.find(role => role.id === id), menus);
    return Object.fromEntries(menus.map(menu => [menu.menu_name, matrix[menu.id]]));
  });
  mocks.save.mockImplementation(async (id: string, payload: RoleSaveRequest) => {
    const role = roles.find(role => role.id === id)!;
    role.description = payload.description;
    setGrants(id, Object.fromEntries(payload.menu_accesses.map(grant => [grant.menu_id, grant.access_type])));
    return structuredClone(role);
  });
  mocks.replacePermissions.mockImplementation(async (id: string, _menus: Menu[], matrix: PermissionMatrix) => setGrants(id, matrix));
});
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });

describe("role editor and active-session permissions", () => {
  it("saves metadata plus the complete matrix atomically and refreshes the active role", async () => {
    const client = renderSession();
    const grant = await screen.findByRole("radio", { name: "Store Management: Write" });
    await waitFor(() => expect(grant).toBeEnabled());
    expect(screen.getByLabelText(/Nama role/)).toBeDisabled();
    fireEvent.click(grant);
    fireEvent.change(screen.getByLabelText("Deskripsi"), { target: { value: "Updated description" } });
    expect(screen.getByTestId("store-access")).toHaveTextContent("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("staff-role", {
      role_name: "staff_internal", description: "Updated description",
      menu_accesses: [{ menu_id: "roles-menu", access_type: "write" }, { menu_id: "stores-menu", access_type: "write" }],
    });
    expect(client.getQueryState(["role-permissions", "source-role"])?.isInvalidated).toBe(false);
  });

  it("retains draft changes and original session permissions when an atomic save fails", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Role could not be saved"));
    renderSession();
    const grant = await screen.findByRole("radio", { name: "Store Management: Write" });
    await waitFor(() => expect(grant).toBeEnabled());
    fireEvent.click(grant);
    fireEvent.change(screen.getByLabelText("Deskripsi"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Role could not be saved");
    expect(screen.getByLabelText("Deskripsi")).toHaveValue("Keep this draft");
    expect(grant).toBeChecked();
    expect(screen.getByTestId("store-access")).toHaveTextContent("hidden");
    expect(mocks.getRolePermissions).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
  });

  it("copies permissions to the selected target and leaves the source cache unchanged", async () => {
    const client = renderSession("/master/roles");
    fireEvent.click(await screen.findByRole("button", { name: "Copy Permissions" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Role sumber"), { target: { value: "source-role" } });
    fireEvent.change(within(dialog).getByLabelText("Role tujuan"), { target: { value: "staff-role" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salin permission" }));
    await waitFor(() => expect(screen.getByTestId("store-access")).toHaveTextContent("write"));
    expect(mocks.replacePermissions).toHaveBeenCalledExactlyOnceWith("staff-role", menus, { "roles-menu": "write", "stores-menu": "write" });
    expect(client.getQueryState(["role-permissions", "source-role"])?.isInvalidated).toBe(false);
  });

  it("keeps View immutable even for a writer", async () => {
    renderSession("/master/roles/staff-role");
    expect(await screen.findByRole("heading", { name: "Detail Role" })).toBeVisible();
    screen.getAllByRole("radio").forEach(radio => expect(radio).toBeDisabled());
    expect(screen.queryByRole("button", { name: "Simpan Perubahan" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
