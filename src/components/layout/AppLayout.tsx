import { useState, ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <motion.div
        initial={false}
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex flex-col min-h-screen md:ml-0"
        style={{ marginLeft: undefined }} // overridden by motion
      >
        {/* On mobile, no sidebar margin */}
        <div className="md:hidden">
          <TopBar title={title} />
        </div>
        <div className="hidden md:block">
          <TopBar title={title} />
        </div>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </motion.div>

      <BottomNav />
    </div>
  );
}
