import {
  ArrowRightLeft,
  Building2,
  LayoutDashboard,
  MapPin,
  Package,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Store,
  Users,
  Warehouse,
  PackageOpenIcon,
  IdCardIcon,
  BadgeDollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MenuKey } from "@/lib/auth";

export type { MenuKey };

export interface NavItemConfig {
  key: MenuKey;
  path: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
  listMenus?: NavItemConfig[];
}
export interface NavGroupConfig {
  group: string;
  role?: string;
  listMenus: NavItemConfig[];
}

export const NAV_GROUPS_MENUS: NavGroupConfig[] = [
  {
    group: "basic",
    role: "basic",
    listMenus: [
      { key: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
      { key: "transactions", path: "/transactions", label: "Transactions", icon: BadgeDollarSign, mobile: true },
      { key: "transactions", path: "/payments", label: "Pembayaran DOKU", icon: ReceiptText },
      { key: "customers", path: "/customers", label: "Customers", icon: Users, mobile: true },
      // { key: "products", path: "/products", label: "Products", icon: Package, mobile: true },
      { key: "koperasi", path: "/master/store", label: "Koperasi", icon: Building2, mobile: true },
    ],
  },
  {
    group: "master data",
    role: "super_admin",
    listMenus: [
      { key: "master_users", path: "/master/users", label: "User Management", icon: Users },
      { key: "master_products", path: "/master/products", label: "Product Management", icon: PackageOpenIcon },
      { key: "master_locations", path: "/master/locations", label: "Location Management", icon: MapPin },
      { key: "master_stock", path: "/master/stocks", label: "Stock Management", icon: Warehouse },
      { key: "master_stock_mutations", path: "/master/stock-mutations", label: "Stock Mutations", icon: ArrowRightLeft },
      { key: "master_stores", path: "/master/stores", label: "Store Management", icon: Store },
      { key: "master_roles", path: "/master/roles", label: "Role Management", icon: ShieldCheck },
    ],
  },

  // { key: "store", path: "/store", label: "Store", icon: ShoppingBag, group: "commerce", mobile: true },
  // { key: "cart", path: "/store/cart", label: "Cart", icon: ReceiptText, group: "commerce" },
];

export function getFilteredNavigation(assignedStoresCount: number): NavGroupConfig[] {
  return NAV_GROUPS_MENUS.map(group => ({
    ...group,
    listMenus: group.listMenus.filter(menu => {
      // Hide products and customers if user has more than 2 assigned stores (admin)
      if (((menu.key === "products" || menu.key === "customers") && assignedStoresCount > 2)) {
        return false;
      }
      
      return true;
    }),
  })).filter(group => group.listMenus.length > 0);
}
