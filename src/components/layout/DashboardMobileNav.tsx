import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { id: "product", label: "Product", icon: Package, path: "/dashboard/products" },
  { id: "transaction", label: "Transaction", icon: ShoppingCart, path: "/transactions" },
];

export function DashboardMobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="md:hidden mb-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.id !== "dashboard" && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
