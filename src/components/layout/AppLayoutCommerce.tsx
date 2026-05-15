import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { TopBarCommerce } from "./TopBarCommerce";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  locationCode: string;
}

export function AppLayoutCommerce({ children, title, locationCode }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <motion.div
        initial={false}
        animate={{ marginLeft: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex flex-col min-h-screen hidden md:block"
        style={{ marginLeft: undefined }} // overridden by motion
      >
        <TopBarCommerce title={title} locationCode={locationCode} />
        <main className="flex-1 py-5 px-2 md:p-6">
          {children}
        </main>
      </motion.div>

      {/* Mobile layout without sidebar margin */}
      <div className="flex flex-col min-h-screen md:hidden">
        <TopBarCommerce title={title} locationCode={locationCode} />
        <main className="flex-1 py-5 px-2 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
