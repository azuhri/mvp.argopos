import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Menu, Role, RoleSaveRequest } from "@/lib/api";
import { matrixPayload, permissionCounts, roleManagementService, roleMatrix } from "./roleManagementService";
const api = vi.hoisted(() => ({ getRoleManagementPage: vi.fn(), getAllMenus: vi.fn(), getRoleWithAccess: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), updateRoleAccess: vi.fn(), deleteRole: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));
const menus: Menu[] = [{ id: "a", menu_name: "transactions" }, { id: "b", menu_name: "payments" }, { id: "c", menu_name: "master_roles" }];
const role: Role = { id: "role-1", role_name: "finance", created_at: "", updated_at: "", access_roles: [{ id: "1", role_id: "role-1", menu_id: "a", access_type: "write", created_at: "", updated_at: "" }] };
beforeEach(() => vi.resetAllMocks());
describe("role matrix contract", () => {
  it("defaults omitted menu grants to hidden and counts exclusive access levels", () => {
    const matrix = roleMatrix(role, menus);
    expect(matrix).toEqual({ a: "write", b: "hidden", c: "hidden" });
    expect(permissionCounts(matrix)).toEqual({ write: 1, read: 0, hidden: 2 });
    expect(matrixPayload(menus, { a: "read" })).toEqual([{ menu_id: "a", access_type: "read" }, { menu_id: "b", access_type: "hidden" }, { menu_id: "c", access_type: "hidden" }]);
  });
  it("loads all pages so role and user counts do not stop at the default page size", async () => {
    api.getRoleManagementPage.mockResolvedValueOnce({ success: true, data: { roles: [role], meta: { total: 2 } } }).mockResolvedValueOnce({ success: true, data: { roles: [{ ...role, id: "role-2" }], meta: { total: 2 } } });
    expect(await roleManagementService.list()).toHaveLength(2);
    expect(api.getRoleManagementPage.mock.calls).toEqual([[1], [2]]);
  });
  it("rejects incomplete pagination instead of showing misleading role totals", async () => {
    api.getRoleManagementPage.mockResolvedValueOnce({ success: true, data: { roles: [role], meta: { total: 2 } } }).mockResolvedValueOnce({ success: true, data: { roles: [], meta: { total: 2 } } });
    await expect(roleManagementService.list()).rejects.toThrow("tidak lengkap");
  });
  it("does not offer a blank permission matrix when menu loading fails", async () => {
    api.getAllMenus.mockResolvedValue({ success: true, data: [] });
    await expect(roleManagementService.menus()).rejects.toThrow("Daftar menu belum tersedia");
  });
  it.each([undefined, "role-1"])("uses one request for metadata and permissions (role %s)", async id => {
    const payload: RoleSaveRequest = { role_name: "finance", description: "Finance", menu_accesses: matrixPayload(menus, { a: "read" }) };
    api.createRole.mockResolvedValue({ success: true, data: role });
    api.updateRole.mockResolvedValue({ success: true, data: role });
    expect(await roleManagementService.save(id, payload)).toEqual(role);
    if (id) expect(api.updateRole).toHaveBeenCalledExactlyOnceWith(id, payload);
    else expect(api.createRole).toHaveBeenCalledExactlyOnceWith(payload);
    expect(api.updateRoleAccess).not.toHaveBeenCalled();
  });
  it("propagates rejected permission updates without reporting success", async () => {
    api.updateRoleAccess.mockRejectedValue(new Error("Last manager cannot lose write access"));
    await expect(roleManagementService.replacePermissions("role-1", menus, {})).rejects.toThrow("Last manager");
  });
});
