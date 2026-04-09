import {
  Building2,
  LayoutDashboard,
  MapPin,
  Package,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MenuKey } from "@/lib/auth";

export type { MenuKey };

export interface NavItemConfig {
  key: MenuKey;
  path: string;
  label: string;
  icon: LucideIcon;
  group: "main" | "master" | "commerce";
  mobile?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { key: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main", mobile: true },
  { key: "transactions", path: "/transactions", label: "POS", icon: ShoppingCart, group: "main", mobile: true },
  { key: "products", path: "/products", label: "Products", icon: Package, group: "main", mobile: true },
  { key: "customers", path: "/customers", label: "Customers", icon: Users, group: "main" },
  { key: "koperasi", path: "/koperasi", label: "Koperasi", icon: Building2, group: "main", mobile: true },

  { key: "master_users", path: "/master/users", label: "Master User", icon: Users, group: "master" },
  { key: "master_locations", path: "/master/locations", label: "Master Lokasi", icon: MapPin, group: "master" },
  { key: "master_roles", path: "/master/roles", label: "Role Management", icon: ShieldCheck, group: "master" },
  { key: "master_stock", path: "/master/stocks", label: "Stock Management", icon: Warehouse, group: "master" },

  { key: "store", path: "/store", label: "Store", icon: ShoppingBag, group: "commerce", mobile: true },
  { key: "cart", path: "/store/cart", label: "Cart", icon: ReceiptText, group: "commerce" },
];
