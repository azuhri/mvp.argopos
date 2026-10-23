import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CommerceBrand } from "@/components/shared/CommerceBrand";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getFilteredNavigation } from "@/lib/navigation";
import { userService } from "@/lib/services/userService";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const formatRole = (role?: string) =>
  role?.replace(/_/g, " ") ?? "User";

export function AppSidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { canRead, user } = useAuth();

  const { data: fullUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => userService.getCurrentUser(),
  });

  const assignedStoresCount = fullUser?.assigned_stores?.length || 0;
  const visibleGroups = getFilteredNavigation(assignedStoresCount)
    .map((group) => ({
      ...group,
      listMenus: group.listMenus.filter((item) => {
        if (!canRead(item.key)) return false;
        if (group.role === "super_admin" && user?.role !== "super_admin") return false;
        return true;
      }),
    }))
    .filter((group) => group.listMenus.length > 0);

  const userInitial = user?.username?.charAt(0).toUpperCase() || "U";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ duration: 0.24, ease: "easeInOut" }}
      className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border bg-sidebar shadow-[4px_0_18px_rgba(7,26,79,0.04)] md:flex"
      aria-label="Navigasi utama"
    >
      <div className={cn("flex h-[72px] shrink-0 items-center border-b border-border px-4", collapsed && "justify-center px-2")}>
        <CommerceBrand
          compact={collapsed}
          to="/dashboard"
          ariaLabel="AMP Mart Admin, buka dashboard"
          subtitle="Commerce admin"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <section key={group.group} aria-label={group.group}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase text-muted-foreground">
                  {group.group}
                </p>
              )}

              <div className="space-y-1">
                {group.listMenus.map((item) => {
                  const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-[#071a4f] text-white shadow-sm dark:bg-[#e30613]"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {isActive && !collapsed && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e30613]"
                          transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                        />
                      )}
                      <item.icon className="relative z-10 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 truncate">
                          {item.label}
                        </motion.span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#071a4f] text-sm font-bold text-white dark:bg-[#e30613]">
            {userInitial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.username || "User"}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{formatRole(user?.role)}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
