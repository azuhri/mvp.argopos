import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  | "master_products";

export type RoleName = "super_admin" | "staff_internal" | "sales_external";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RoleName;
  type: "internal" | "external";
  employee_id?: string;
}

type PermissionMap = Record<MenuKey, PermissionMode>;

const ROLE_PERMISSIONS: Record<RoleName, PermissionMap> = {
  super_admin: {
    dashboard: "write",
    transactions: "write",
    products: "write",
    customers: "write",
    koperasi: "write",
    store: "write",
    cart: "write",
    master_users: "write",
    master_locations: "write",
    master_roles: "write",
    master_stock: "write",
    master_products: "write",
  },
  staff_internal: {
    dashboard: "read",
    transactions: "write",
    products: "write",
    customers: "write",
    koperasi: "read",
    store: "read",
    cart: "write",
    master_users: "hidden",
    master_locations: "read",
    master_roles: "hidden",
    master_stock: "write",
    master_products: "write",
  },
  sales_external: {
    dashboard: "read",
    transactions: "read",
    products: "read",
    customers: "hidden",
    koperasi: "hidden",
    store: "write",
    cart: "write",
    master_users: "hidden",
    master_locations: "hidden",
    master_roles: "hidden",
    master_stock: "hidden",
    master_products: "hidden",
  },
};

const LOGIN_USERS: Array<AuthUser & { password: string }> = [
  {
    id: "u-1",
    name: "Admin Argo",
    email: "admin@argopos.id",
    phone: "081111111111",
    role: "super_admin",
    type: "internal",
    employee_id: "EMP-000",
    password: "admin123",
  },
  {
    id: "u-2",
    name: "Staff Koperasi",
    email: "staff@argopos.id",
    phone: "082222222222",
    role: "staff_internal",
    type: "internal",
    employee_id: "EMP-010",
    password: "staff123",
  },
  {
    id: "u-3",
    name: "Sales External",
    email: "sales@mitra.id",
    phone: "083333333333",
    role: "sales_external",
    type: "external",
    password: "sales123",
  },
];

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  getPermission: (menuKey: MenuKey) => PermissionMode;
  canRead: (menuKey: MenuKey) => boolean;
  canWrite: (menuKey: MenuKey) => boolean;
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

  const login: AuthContextValue["login"] = async (identifier, password) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const found = LOGIN_USERS.find(
      (u) => (u.email === identifier || u.phone === identifier) && u.password === password
    );

    if (!found) {
      return { ok: false, message: "Email/phone atau password tidak valid" };
    }

    const { password: _, ...safeUser } = found;
    setUser(safeUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getPermission = (menuKey: MenuKey): PermissionMode => {
    if (!user) return "hidden";
    return ROLE_PERMISSIONS[user.role][menuKey] ?? "hidden";
  };

  const canRead = (menuKey: MenuKey) => {
    const mode = getPermission(menuKey);
    return mode === "read" || mode === "write";
  };

  const canWrite = (menuKey: MenuKey) => getPermission(menuKey) === "write";

  const value = useMemo(
    () => ({ user, loading, login, logout, getPermission, canRead, canWrite }),
    [user, loading]
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
