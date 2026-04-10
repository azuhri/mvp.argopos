import { useState, useEffect, ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
    // Read from localStorage on initial load
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebar:collapsed");
        return saved !== null ? JSON.parse(saved) : false;
      } catch {
        return false;
      }
    }
    return false;
  });

  // Update localStorage when state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sidebar:collapsed", JSON.stringify(collapsed));
      } catch {
        // Silent fail
      }
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <motion.div
        initial={false}
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex flex-col min-h-screen hidden md:block"
        style={{ marginLeft: undefined }} // overridden by motion
      >
        <TopBar title={title} />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </motion.div>

      {/* Mobile layout without sidebar margin */}
      <div className="flex flex-col min-h-screen md:hidden">
        <TopBar title={title} />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
