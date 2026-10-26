import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sidebar:collapsed", JSON.stringify(collapsed));
      } catch {
        // Layout preference should not block the workspace.
      }
    }
  }, [collapsed]);

  return (
    <div className="admin-theme min-h-screen bg-background text-foreground">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div
        className="flex min-h-screen flex-col transition-[padding] duration-200 ease-in-out md:pl-[var(--sidebar-width)]"
        style={{ "--sidebar-width": `${collapsed ? 76 : 260}px` } as CSSProperties}
      >
        <TopBar title={title} />
        <main className="flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 md:px-5 md:pt-6 lg:px-8 lg:pt-7">
          <div className="mx-auto w-full max-w-[1500px]">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
