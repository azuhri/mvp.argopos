import { CalendarIcon, History, Search, ShoppingBag, StoreIcon } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart as ShoppingCartIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";
import { getCartSummary } from "@/lib/storefront";
import { useState, useEffect } from "react";
import config from "../../lib/config";
import { cn } from "@/lib/utils";

interface TopBarCommerceProps {
  title: string;
  locationCode: string;
  productName?: string;
  openModalInfo?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

function CommerceLogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#18246c] shadow-lg shadow-primary/15", className)}>
      <ShoppingBag className="h-7 w-7 text-white" strokeWidth={2.4} />
      <span className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-[#ff8a12]" />
      <span className="absolute bottom-3 h-3 w-7 rounded-b-full border-b-[5px] border-[#ffd23f]" />
    </div>
  );
}

function BrandBlock() {
  return (
    <Link to="/commerce" className="flex min-w-0 items-center gap-3">
      <CommerceLogoMark />
      <div className="min-w-0">
        <p className="truncate text-xl font-extrabold leading-tight text-foreground md:text-[1.35rem]">
          AMP Mart
        </p>
        <div className="mt-1 inline-flex rounded-full bg-[#fff0d7] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#f06f00]">
          Fresh Frozen
        </div>
      </div>
    </Link>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  if (!onChange) return null;

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#60708f]" />
      <input
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || "Cari produk..."}
        className="h-12 w-full rounded-2xl border border-border bg-card px-12 text-[15px] font-medium text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}

export function TopBarCommerce({
  title,
  locationCode,
  openModalInfo,
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: TopBarCommerceProps) {
  const [cartSummary, setCartSummary] = useState(() => getCartSummary());

  useEffect(() => {
    const handleStorageChange = () => {
      setCartSummary(getCartSummary());
    };

    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const { items, total, totalItems } = cartSummary;
  const showStorePill = Boolean(title && title !== config.appNameCommerce && title !== "Loading..." && title !== "Product Not Found");
  const cartUrl = locationCode ? `/${locationCode}/commerce/cart` : "/commerce/cart";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 px-3 py-3 shadow-sm backdrop-blur-2xl md:px-6">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3">
        <div className="flex min-h-[56px] items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <BrandBlock />
          </div>

          {showStorePill && (
            <Link to="/commerce" className="commerce-pill hidden min-w-[150px] justify-start rounded-2xl md:inline-flex">
              <StoreIcon className="h-4 w-4 text-primary" />
              <span className="truncate">{title}</span>
            </Link>
          )}

          <SearchBox
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="hidden flex-1 md:block"
          />

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="hidden h-12 rounded-2xl px-4 font-extrabold text-primary md:inline-flex"
            >
              <History className="h-4 w-4" />
              Riwayat
            </Button>

            <ThemeToggle className="h-12 w-12 rounded-2xl bg-secondary text-primary" />

            {openModalInfo && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={openModalInfo}
                className="inline-flex h-12 w-12 rounded-2xl text-primary"
                aria-label="Info operasional toko"
              >
                <CalendarIcon className="h-5 w-5" />
              </Button>
            )}

            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-12 w-12 rounded-2xl bg-primary p-0 text-white shadow-lg shadow-primary/20 hover:bg-primary">
                    <ShoppingCartIcon className="h-5 w-5" strokeWidth={2.4} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="commerce-panel-soft w-80 max-w-[calc(100vw-2rem)] p-0">
                  <DropdownMenuItem className="block cursor-default p-0 focus:bg-transparent">
                    <div className="w-full p-4">
                      {totalItems === 0 ? (
                        <div className="py-6 text-center">
                          <ShoppingBag className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
                          <h2 className="mb-1 text-base font-extrabold text-foreground">Keranjang Kosong</h2>
                          <p className="text-sm text-muted-foreground">Belum ada produk di keranjang kamu</p>
                        </div>
                      ) : (
                        <div className="mb-3 flex items-center justify-between">
                          <h2 className="text-sm font-extrabold text-foreground">Keranjang ({totalItems})</h2>
                          <Link to={cartUrl} className="text-xs font-bold text-primary hover:underline">
                            Lihat Keranjang
                          </Link>
                        </div>
                      )}

                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        <AnimatePresence>
                          {items.map((item) => (
                            <motion.div
                              key={item.productId}
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -16 }}
                              className="rounded-2xl border border-border/80 bg-card p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="commerce-product-visual flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                                  <img
                                    src={item.product.image_url || ""}
                                    alt={item.product.name}
                                    className="h-12 w-12 object-contain"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h3 className="line-clamp-1 text-sm font-bold text-foreground">
                                    {item.product.name}
                                  </h3>
                                  <div className="mt-1 flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                      {item.qty} item
                                    </span>
                                    <p className="text-sm font-extrabold text-primary">
                                      {formatCurrency(item.subtotal)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      {items.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-muted-foreground">Total</span>
                            <span className="text-base font-extrabold text-primary">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {totalItems > 0 && (
                <p className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff7a00] px-1.5 text-[11px] font-extrabold text-white">
                  {totalItems}
                </p>
              )}
            </div>
          </div>
        </div>

        <SearchBox
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="md:hidden"
        />
      </div>
    </header>
  );
}
