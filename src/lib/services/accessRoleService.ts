import { apiClient, type AccessRole, type Role, type Menu, type ApiResponse } from '@/lib/api';

// Response interfaces
export interface AccessRoleListResponse {
  data: AccessRole[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface RoleListResponse {
  roles: Role[];
  meta?: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface MenuListResponse {
  menus: Menu[];
  meta?: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface CheckAccessResponse {
  exists: boolean;
  access_type?: string;
}

// Request interfaces
export interface CreateAccessRoleRequest {
  role_id: string;
  menu_id: string;
  access_type: 'hidden' | 'read' | 'write';
}

export interface UpdateAccessRoleRequest {
  role_id: string;
  menu_id: string;
  access_type: 'hidden' | 'read' | 'write';
}

export interface UpdateRoleAccessRequest {
  menu_accesses: {
    menu_id: string;
    access_type: 'hidden' | 'read' | 'write';
  }[];
}

export interface AccessRoleFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  roleId?: string;
  menuId?: string;
  accessType?: string;
}

class AccessRoleService {
  // Basic CRUD operations
  async getAccessRoles(filter: AccessRoleFilter = {}): Promise<AccessRoleListResponse> {
    const response = await apiClient.getAccessRoles(
      filter.page || 1,
      filter.pageSize || 20,
      filter.search || '',
      filter.roleId,
      filter.menuId,
      filter.accessType
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get access roles');
    }
    return response.data;
  }

  async getAccessRole(id: string): Promise<AccessRole> {
    const response = await apiClient.getAccessRole(id);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get access role');
    }
    return response.data;
  }

  async createAccessRole(accessRole: CreateAccessRoleRequest): Promise<AccessRole> {
    const response = await apiClient.createAccessRole(accessRole);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create access role');
    }
    return response.data;
  }

  async createRole(role: { role_name: string; description: string }): Promise<Role> {
    const response = await apiClient.createRole(role);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create role');
    }
    return response.data;
  }

  async updateRole(id: string, role: { role_name: string; description: string }): Promise<Role> {
    const response = await apiClient.updateRole(id, role);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update role');
    }
    return response.data;
  }

  async createBulkAccessRoles(accessRoles: { access_roles: Partial<AccessRole>[] }): Promise<AccessRole[]> {
    const response = await apiClient.createBulkAccessRoles(accessRoles);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create bulk access roles');
    }
    return response.data;
  }

  async updateAccessRole(id: string, accessRole: UpdateAccessRoleRequest): Promise<AccessRole> {
    const response = await apiClient.updateAccessRole(id, accessRole);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update access role');
    }
    return response.data;
  }

  async deleteAccessRole(id: string): Promise<void> {
    const response = await apiClient.deleteAccessRole(id);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete access role');
    }
  }

  // Query operations
  async getAccessRolesByRole(roleId: string): Promise<AccessRole[]> {
    const response = await apiClient.getAccessRolesByRole(roleId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get access roles by role');
    }
    return response.data;
  }

  async getAccessRolesByMenu(menuId: string): Promise<AccessRole[]> {
    const response = await apiClient.getAccessRolesByMenu(menuId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get access roles by menu');
    }
    return response.data;
  }

  // Bulk operations
  async updateRoleAccess(roleId: string, menuAccesses: UpdateRoleAccessRequest['menu_accesses']): Promise<void> {
    const response = await apiClient.updateRoleAccess(roleId, menuAccesses);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update role access');
    }
  }

  async deleteByRoleID(roleId: string): Promise<void> {
    const response = await apiClient.deleteAccessRole(`/access-roles/role/${roleId}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete access by role');
    }
  }

  async deleteByMenuID(menuId: string): Promise<void> {
    const response = await apiClient.deleteAccessRole(`/access-roles/menu/${menuId}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete access by menu');
    }
  }

  // Role and Menu operations
  async getRoleWithAccess(roleId: string): Promise<Role> {
    const response = await apiClient.getRoleWithAccess(roleId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get role with access');
    }
    return response.data;
  }

  async getMenuWithAccess(menuId: string): Promise<Menu> {
    const response = await apiClient.getMenuWithAccess(menuId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get menu with access');
    }
    return response.data;
  }

  async getAllRoles(): Promise<Role[]> {
    const response = await apiClient.getAllRoles();
    console.log('API response in getAllRoles:', JSON.stringify(response, null, 2));

    if (!response.success) {
      throw new Error(response.message || 'Failed to get all roles');
    }

    // Backend returns: { success: true, data: { roles: [...], meta: {...} } }
    // axios interceptor returns the parsed JSON body
    const data = response.data as any;
    // Extract roles from response.data.roles or response.data (direct array)
    const roles = data?.roles || data || [];
    console.log('Extracted roles in service:', roles);

    return roles;
  }

  async getAllMenus(): Promise<Menu[]> {
    const response = await apiClient.getAllMenus();
    console.log('API response in getAllMenus:', JSON.stringify(response, null, 2));

    if (!response.success) {
      throw new Error(response.message || 'Failed to get all menus');
    }

    // Backend returns: { success: true, data: [...] }
    // axios interceptor returns the parsed JSON body
    const data = response.data as any;
    // response.data is directly the array (from ListMenus)
    const menus = Array.isArray(data) ? data : (data?.data || []);
    console.log('Extracted menus in service:', menus);

    return menus;
  }

  // Utility
  async checkAccess(roleId: string, menuId: string): Promise<CheckAccessResponse> {
    const response = await apiClient.checkAccess(roleId, menuId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to check access');
    }
    return response.data;
  }

  // Helper methods
  async getRolePermissions(roleId: string): Promise<Record<string, 'hidden' | 'read' | 'write'>> {
    const roleWithAccess = await this.getRoleWithAccess(roleId);
    const permissions: Record<string, 'hidden' | 'read' | 'write'> = {};

    console.log('Role with access:', JSON.stringify(roleWithAccess, null, 2));

    if (roleWithAccess.access_roles && Array.isArray(roleWithAccess.access_roles)) {
      roleWithAccess.access_roles.forEach((accessRole: any) => {
        if (accessRole.menu) {
          // menu_name from backend is already lowercase (e.g., "dashboard", "master_users")
          const menuKey = accessRole.menu.menu_name.toLowerCase();
          permissions[menuKey] = accessRole.access_type as 'hidden' | 'read' | 'write';
          console.log(`Mapped permission: ${menuKey} = ${accessRole.access_type}`);
        }
      });
    }

    console.log('Final permissions object:', permissions);
    return permissions;
  }

  async setRolePermissions(roleId: string, permissions: Record<string, 'hidden' | 'read' | 'write'>): Promise<void> {
    const menus = await this.getAllMenus();
    if (permissions.master_stores && permissions.master_stores !== 'hidden' &&
      !menus.some(menu => menu.menu_name.toLowerCase() === 'master_stores')) {
      throw new Error('Menu Store Management belum tersedia di server. Hubungi administrator untuk memperbarui daftar menu sebelum menyimpan izin.');
    }
    console.log('Available menus from backend:', menus.map(m => ({ id: m.id, menu_name: m.menu_name })));
    console.log('Permissions from frontend:', permissions);

    const menuAccesses = menus.map(menu => {
      // menu_name from backend is already lowercase (e.g., "dashboard", "master_users")
      const menuKey = menu.menu_name.toLowerCase();
      const accessType = permissions[menuKey] || 'hidden';
      console.log(`Mapping menu: ${menu.menu_name} -> menuKey: ${menuKey} -> access_type: ${accessType}`);
      return {
        menu_id: menu.id,
        access_type: accessType
      };
    });

    console.log('Final menuAccesses to send to backend:', menuAccesses);
    await this.updateRoleAccess(roleId, menuAccesses);
  }

  formatAccessLabel(accessType: string): string {
    const labels = {
      'hidden': 'Hidden',
      'read': 'Read',
      'write': 'Write'
    };
    return labels[accessType as keyof typeof labels] || accessType;
  }

  getAccessColor(accessType: string): string {
    const colors = {
      'hidden': 'destructive',
      'read': 'secondary',
      'write': 'default'
    };
    return colors[accessType as keyof typeof colors] || 'secondary';
  }
}

export const accessRoleService = new AccessRoleService();
export default accessRoleService;
