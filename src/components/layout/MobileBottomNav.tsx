import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { MenuKey } from "@/lib/auth";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  permissionKey: MenuKey;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", permissionKey: "dashboard" },
  { id: "product", label: "Product", icon: Package, path: "/dashboard/products", permissionKey: "master_products" },
  { id: "transaction", label: "Transaction", icon: ShoppingCart, path: "/dashboard/transactions", permissionKey: "transactions" },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canRead } = useAuth();

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter(item => canRead(item.permissionKey));

  if (visibleNavItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border/50 md:hidden z-50">
      <div className="flex items-center justify-around h-16 px-4">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all duration-200",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
