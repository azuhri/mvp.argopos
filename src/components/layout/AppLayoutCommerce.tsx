import { ReactNode } from "react";
import { TopBarCommerce } from "./TopBarCommerce";

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
      <div className="flex min-h-screen flex-col">
        <TopBarCommerce
          title={title}
          locationCode={locationCode}
          openModalInfo={openModalInfo}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="flex-1 px-3 py-4 pb-24 md:px-6 md:py-6 md:pb-6 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
