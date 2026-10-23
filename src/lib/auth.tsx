import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type User, type AccessRole, type LoginResponse } from "./api";
import { accessRoleService } from "./services/accessRoleService";

export type PermissionMode = "hidden" | "read" | "write";

export type MenuKey =
  | "dashboard"
  | "transactions"
  | "products"
  | "customers"
  | "koperasi"
  | "store"
  | "cart"
  | "master_users"
  | "master_locations"
  | "master_roles"
  | "master_stock"
  | "master_stock_mutations"
  | "master_products"
  | "master_stores";

export type RoleName = "super_admin" | "admin" | "staff_internal" | "sales_external";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: RoleName;
  role_id: string;
  created_at: string;
  updated_at: string;
}

type PermissionMap = Record<MenuKey, PermissionMode>;

// This is for demo purposes only - in production, this will be replaced with actual API calls
const LOGIN_USERS: Array<AuthUser & { password: string }> = [
  {
    id: "u-1",
    username: "admin",
    email: "admin@argopos.id",
    role: "super_admin",
    role_id: "role-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    password: "admin123",
  },
  {
    id: "u-2",
    username: "staff",
    email: "staff@argopos.id",
    role: "staff_internal",
    role_id: "role-2",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    password: "staff123",
  },
  {
    id: "u-3",
    username: "sales",
    email: "sales@mitra.id",
    role: "sales_external",
    role_id: "role-3",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    password: "sales123",
  },
];

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string; data?: LoginResponse }>;
  logout: () => void;
  getPermission: (menuKey: MenuKey) => PermissionMode;
  canRead: (menuKey: MenuKey) => boolean;
  canWrite: (menuKey: MenuKey) => boolean;
  refreshPermissions: () => Promise<void>;
  permissionsRefreshing: boolean;
}

// Hook to fetch permissions from API
function usePermissions(roleId?: string) {
  const { data: permissions = {}, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: async () => {
      if (!roleId) return {};
      try {
        const result = await accessRoleService.getRolePermissions(roleId);
        console.log('Fetched permissions for roleId:', roleId, result);
        return result;
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
        // Return empty permissions - don't use hardcoded fallback
        return {};
      }
    },
    enabled: !!roleId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { permissions, loading: isLoading, refreshing: isFetching, refetch };
}

const STORAGE_KEY = "argopos.auth.user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const token = localStorage.getItem('argopos.auth.token');

      if (!token) {
        setUser(null);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const login: AuthContextValue["login"] = async (email, password) => {
    try {
      const response = await apiClient.login({ email, password });

      if (response.success && response.data) {
        const { token, user } = response.data;

        // Safety check for user data
        if (!user || !token) {
          throw new Error("Invalid login response format");
        }

        // Store token
        localStorage.setItem('argopos.auth.token', token);

        // Transform user data to match AuthUser interface
        const authUser: AuthUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role?.role_name as RoleName || 'sales_external',
          role_id: user.role_id,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };

        setUser(authUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        return { ok: true, data: response.data };
      } else {
        return { ok: false, message: response.message || "Login gagal" };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = (error?.message as string)?.toLowerCase() || "Terjadi kesalahan saat login";
      if (errorMessage.includes('unauthorized')) {
        return { ok: false, message: "email or password is incorrect" };
      }
      return { ok: false, message: errorMessage };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('argopos.auth.token');
  };

  // Use dynamic permissions from API
  const { permissions, loading: permissionsLoading, refreshing: permissionsRefreshing, refetch: refetchPermissions } = usePermissions(user?.role_id);
  const refreshPermissions = useCallback(async (): Promise<void> => {
    if (!user?.role_id) return;
    await refetchPermissions();
  }, [refetchPermissions, user?.role_id]);

  const getPermission = (menuKey: MenuKey): PermissionMode => {
    if (!user || permissionsLoading) return "hidden";
    return permissions[menuKey] ?? "hidden";
  };

  const canRead = (menuKey: MenuKey) => {
    const mode = getPermission(menuKey);
    return mode === "read" || mode === "write";
  };

  const canWrite = (menuKey: MenuKey) => {
    const mode = getPermission(menuKey);
    return mode === "write";
  };

  const combinedLoading = loading || permissionsLoading;

  const value = useMemo(
    () => ({
      user,
      loading: combinedLoading,
      login,
      logout,
      getPermission,
      canRead,
      canWrite,
      refreshPermissions,
      permissionsRefreshing,
    }),
    [user, combinedLoading, permissions, refreshPermissions, permissionsRefreshing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
