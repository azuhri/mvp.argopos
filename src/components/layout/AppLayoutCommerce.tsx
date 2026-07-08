import { ReactNode } from "react";
import { TopBarCommerce } from "./TopBarCommerce";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  locationCode: string;
  openModalInfo?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function AppLayoutCommerce({
  children,
  title,
  locationCode,
  openModalInfo,
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: AppLayoutProps) {
  return (
    <div className="commerce-theme commerce-surface min-h-screen">
      <motion.div
        initial={false}
        animate={{ marginLeft: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="hidden min-h-screen flex-col md:flex"
        style={{ marginLeft: undefined }} // overridden by motion
      >
        <TopBarCommerce
          title={title}
          locationCode={locationCode}
          openModalInfo={openModalInfo}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </motion.div>

      <div className="flex flex-col min-h-screen md:hidden">
        <TopBarCommerce
          title={title}
          locationCode={locationCode}
          openModalInfo={openModalInfo}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="flex-1 px-3 py-4 pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}
