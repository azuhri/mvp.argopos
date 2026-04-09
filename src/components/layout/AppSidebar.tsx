import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Snowflake,
} from "lucide-react";
import { config } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS, type NavItemConfig } from "@/lib/navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { canRead } = useAuth();

  // Filter navigation items based on user permissions
  const visibleNavItems = NAV_ITEMS.filter(item => canRead(item.key));

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 glass-strong border-r border-border/40"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border/40">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Snowflake className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-bold text-lg tracking-tight text-foreground whitespace-nowrap"
            >
              {config.appName}
            </motion.span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-accent border border-primary/10"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <item.icon className="h-5 w-5 flex-shrink-0 relative z-10" />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative z-10 whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-border/40">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center h-9 rounded-lg bg-secondary hover:bg-accent transition-colors btn-tap"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
