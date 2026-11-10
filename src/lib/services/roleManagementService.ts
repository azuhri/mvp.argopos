import { apiClient, type ApiResponse, type Menu, type Role, type RoleSaveRequest } from "@/lib/api";

export type Permission = "hidden" | "read" | "write";
export type PermissionMatrix = Record<string, Permission>;

function value<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data == null) throw new Error(response.message || fallback);
  return response.data;
}

export function roleMatrix(role: Role | undefined, menus: Menu[]): PermissionMatrix {
  const grants = new Map((role?.access_roles ?? []).map(grant => [grant.menu_id || grant.menu?.id, grant.access_type]));
  return Object.fromEntries(menus.map(menu => {
    const access = grants.get(menu.id);
    return [menu.id, access === "write" || access === "read" ? access : "hidden"];
  }));
}

export function permissionCounts(matrix: PermissionMatrix) {
  const counts = { hidden: 0, read: 0, write: 0 };
  Object.values(matrix).forEach(access => { counts[access]++; });
  return counts;
}

export function matrixPayload(menus: Menu[], matrix: PermissionMatrix): RoleSaveRequest["menu_accesses"] {
  return menus.map(menu => ({ menu_id: menu.id, access_type: matrix[menu.id] || "hidden" }));
}

export const roleManagementService = {
  async list(): Promise<Role[]> {
    const roles: Role[] = [];
    const seen = new Set<string>();
    for (let page = 1; ; page++) {
      const data = value(await apiClient.getRoleManagementPage(page), "Daftar role belum dapat dimuat.");
      // Keep older list envelopes readable while migration/deployment completes.
      const batch = Array.isArray(data) ? data as Role[] : data.roles;
      if (!Array.isArray(batch)) throw new Error("Format daftar role tidak valid.");
      const added = batch.filter(role => !seen.has(role.id));
      added.forEach(role => { seen.add(role.id); roles.push(role); });
      const meta = Array.isArray(data) ? undefined : data.meta;
      if (!meta || roles.length >= meta.total) return roles;
      if (!added.length) throw new Error("Daftar role tidak lengkap. Coba muat ulang.");
    }
  },
  async menus(): Promise<Menu[]> {
    const menus = value(await apiClient.getAllMenus(), "Daftar menu belum dapat dimuat.");
    if (!Array.isArray(menus) || !menus.length) throw new Error("Daftar menu belum tersedia. Muat ulang sebelum mengatur akses.");
    return menus;
  },
  async get(id: string): Promise<Role> {
    return value(await apiClient.getRoleWithAccess(id), "Role belum dapat dimuat.");
  },
  async save(id: string | undefined, payload: RoleSaveRequest): Promise<Role> {
    const role = value(await (id ? apiClient.updateRole(id, payload) : apiClient.createRole(payload)), "Role belum dapat disimpan.");
    if (!role.id) throw new Error("Respons penyimpanan role tidak lengkap. Muat ulang daftar untuk memeriksa hasilnya.");
    return role;
  },
  async replacePermissions(id: string, menus: Menu[], matrix: PermissionMatrix): Promise<void> {
    const response = await apiClient.updateRoleAccess(id, matrixPayload(menus, matrix));
    if (!response.success) throw new Error(response.message || "Permission belum dapat disimpan.");
  },
  async remove(id: string): Promise<void> {
    const response = await apiClient.deleteRole(id);
    if (!response.success) throw new Error(response.message || "Role belum dapat dihapus.");
  },
};
