import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { getFilteredNavigation } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { userService } from "@/lib/services/userService";

export function BottomNav() {
  const location = useLocation();
  const { canRead, user } = useAuth();

  // Fetch full user data to get assigned_stores
  const { data: fullUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => userService.getCurrentUser(),
  });
  const assignedStoresCount = fullUser?.assigned_stores?.length || 0;
  const filteredNav = getFilteredNavigation(assignedStoresCount);

  const visibleNavItems = filteredNav.flatMap((group) => {
    if (group.role === "super_admin" && user?.role !== "super_admin") return [];
    return group.listMenus.filter((item) => item.mobile && canRead(item.key));
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-2 pb-safe shadow-[0_-8px_24px_rgba(7,26,79,0.08)] md:hidden" aria-label="Navigasi mobile">
      <div className="flex h-16 items-center justify-around">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <NavLink
              key={item.key}
              to={item.path}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-w-14 flex-col items-center gap-1 rounded-md px-2 py-2"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute -top-0.5 w-full h-0.5 -translate-x-1/2 rounded-full bg-[#e30613]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  isActive ? "text-[#071a4f] dark:text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors duration-200",
                  isActive ? "font-bold text-[#071a4f] dark:text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
