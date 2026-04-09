import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/navigation";

export function BottomNav() {
  const location = useLocation();
  const { canRead } = useAuth();

  // Filter mobile navigation items based on user permissions
  const visibleNavItems = NAV_ITEMS.filter(item => item.mobile && canRead(item.key));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border/40 px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className="relative flex flex-col items-center gap-1 py-2"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute -top-1 left-0 w-full h-1 rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
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
