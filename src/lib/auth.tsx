import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type User, type LoginResponse } from "./api";
import { subscribeRolePermissionsChanged } from "./permissionEvents";
import { accessRoleService } from "./services/accessRoleService";
import { userService } from "./services/userService";

export type PermissionMode = "hidden" | "read" | "write";

export type MenuKey =
  | "dashboard"
  | "transactions"
  | "payments"
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

// Role names are managed in the CMS, including roles created by administrators.
export type RoleName = string;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: RoleName;
  role_id: string;
  created_at: string;
  updated_at: string;
}

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

const STORAGE_KEY = "argopos.auth.user";
const TOKEN_KEY = "argopos.auth.token";
const PERMISSION_REFRESH_INTERVAL = 30_000;

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const user: unknown = JSON.parse(raw);
    if (user && typeof user === "object" && "id" in user && typeof user.id === "string" && "role_id" in user && typeof user.role_id === "string") {
      return user as AuthUser;
    }
  } catch {
    // Invalid persisted state is not an authenticated session.
  }
  localStorage.removeItem(STORAGE_KEY);
  return null;
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role?.role_name ?? "",
    role_id: user.role_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function usePermissions(roleId?: string) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: async () => {
      if (!roleId) return {};
      try {
        return await accessRoleService.getRolePermissions(roleId);
      } catch {
        // A failed refresh must revoke cached privileges rather than keep old grants.
        return {};
      }
    },
    enabled: !!roleId,
    staleTime: PERMISSION_REFRESH_INTERVAL,
    refetchInterval: PERMISSION_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionUser(readStoredUser());
    setLoading(false);
  }, []);

  const clearSessionQueries = useCallback(() => {
    for (const queryKey of [["current-user"], ["role-permissions"]]) {
      void queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    }
  }, [queryClient]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY && event.key !== TOKEN_KEY) return;
      clearSessionQueries();
      setSessionUser(localStorage.getItem(TOKEN_KEY) ? readStoredUser() : null);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearSessionQueries]);

  // Resolve role reassignment from the authenticated server profile, not a stale JWT
  // or localStorage role. The existing key is shared with store-assignment views.
  const profile = useQuery({
    queryKey: ["current-user"],
    queryFn: () => userService.getCurrentUser(),
    enabled: !!sessionUser?.id,
    retry: false,
    staleTime: PERMISSION_REFRESH_INTERVAL,
    refetchInterval: PERMISSION_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  const user = useMemo(
    () => sessionUser && profile.data?.id === sessionUser.id ? toAuthUser(profile.data) : sessionUser,
    [sessionUser, profile.data],
  );

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  const login: AuthContextValue["login"] = useCallback(async (email, password) => {
    try {
      const response = await apiClient.login({ email, password });
      if (!response.success || !response.data) {
        return { ok: false, message: response.message || "Login gagal" };
      }
      const { token, user: loggedInUser } = response.data;
      if (!loggedInUser || !token) throw new Error("Invalid login response format");
      clearSessionQueries();
      const authUser = toAuthUser(loggedInUser);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      queryClient.setQueryData(["current-user"], loggedInUser);
      setSessionUser(authUser);
      return { ok: true, data: response.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "Terjadi kesalahan saat login";
      return { ok: false, message: errorMessage.includes("unauthorized") ? "email or password is incorrect" : errorMessage };
    }
  }, [clearSessionQueries, queryClient]);

  const logout = useCallback(() => {
    setSessionUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    clearSessionQueries();
  }, [clearSessionQueries]);

  const { data: permissions = {}, isLoading: permissionsLoading, isFetching: permissionsRefreshing, refetch: refetchPermissions } = usePermissions(user?.role_id);
  const refreshPermissions = useCallback(async (): Promise<void> => {
    if (!user?.role_id) return;
    await refetchPermissions();
  }, [refetchPermissions, user?.role_id]);

  useEffect(() => subscribeRolePermissionsChanged((roleId) => {
    void queryClient.invalidateQueries({ queryKey: ["role-permissions", roleId], exact: true });
  }), [queryClient]);

  const getPermission = useCallback((menuKey: MenuKey): PermissionMode => {
    if (!user || profile.isError || permissionsLoading) return "hidden";
    const permission = permissions[menuKey];
    return permission === "read" || permission === "write" ? permission : "hidden";
  }, [user, profile.isError, permissionsLoading, permissions]);

  const canRead = useCallback((menuKey: MenuKey) => {
    const mode = getPermission(menuKey);
    return mode === "read" || mode === "write";
  }, [getPermission]);
  const canWrite = useCallback((menuKey: MenuKey) => getPermission(menuKey) === "write", [getPermission]);
  const combinedLoading = loading || profile.isLoading || permissionsLoading;

  const value = useMemo(() => ({
    user,
    loading: combinedLoading,
    login,
    logout,
    getPermission,
    canRead,
    canWrite,
    refreshPermissions,
    permissionsRefreshing,
  }), [user, combinedLoading, login, logout, getPermission, canRead, canWrite, refreshPermissions, permissionsRefreshing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
