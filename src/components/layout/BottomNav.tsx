import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { getFilteredNavigation, type NavItemConfig } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { userService } from "@/lib/services/userService";
import { ScanLine } from "lucide-react";

export function BottomNav() {
  const location = useLocation();
  const { canRead, canWrite, user } = useAuth();
  const canScan = canWrite("transactions");

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

  const renderNavItem = (item: NavItemConfig) => {
    const isActive = (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) && location.pathname !== "/transactions/pickup-scan";
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={location.pathname === "/transactions/pickup-scan"}
        aria-current={isActive ? "page" : undefined}
        className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            "max-w-full truncate text-[10px] font-medium transition-colors duration-200",
            isActive ? "font-bold text-[#071a4f] dark:text-primary" : "text-muted-foreground"
          )}
        >
          {item.label}
        </span>
      </NavLink>
    );
  };
  const splitAt = Math.ceil(visibleNavItems.length / 2);
  return (
    <nav
      className={cn("fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(7,26,79,0.08)]", canScan ? "md:bottom-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:rounded-2xl md:border md:px-3 md:pb-0" : "md:hidden")}
      aria-label="Navigasi admin"
    >
      <div className={cn("min-h-16 items-center", canScan ? "grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] gap-1 md:flex" : "flex justify-around")}>
        {canScan ? <>
          <div className="flex min-w-0 md:hidden">{visibleNavItems.slice(0, splitAt).map(renderNavItem)}</div>
          <NavLink
            to="/transactions/pickup-scan"
            aria-label="Scan QR penyerahan"
            aria-current={location.pathname === "/transactions/pickup-scan" ? "page" : undefined}
            className="my-2 flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-[#e30613] px-3 py-2 text-white shadow-sm transition-colors hover:bg-[#c5000c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:flex-row md:gap-2 md:px-5"
          >
            <ScanLine className="h-5 w-5" aria-hidden="true" />
            <span className="whitespace-nowrap text-[10px] font-semibold md:text-sm">Scan QR</span>
          </NavLink>
          <div className="flex min-w-0 md:hidden">{visibleNavItems.slice(splitAt).map(renderNavItem)}</div>
        </> : visibleNavItems.map(renderNavItem)}
      </div>
    </nav>
  );
}
