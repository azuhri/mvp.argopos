import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  Search,
  ShoppingBag,
  ShoppingCart,
  StoreIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommerceBrand } from "@/components/shared/CommerceBrand";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { formatCurrency } from "@/lib/mockData";
import { getCartSummary } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import config from "../../lib/config";

interface TopBarCommerceProps {
  title: string;
  locationCode: string;
  productName?: string;
  openModalInfo?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
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
    <label className={cn("relative block", className)}>
      <span className="sr-only">Cari produk</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || "Cari produk..."}
        className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#071a4f] focus:bg-white focus:ring-2 focus:ring-[#071a4f]/10"
      />
    </label>
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
    const syncCart = () => setCartSummary(getCartSummary());

    window.addEventListener("storage", syncCart);
    const interval = window.setInterval(syncCart, 500);

    return () => {
      window.removeEventListener("storage", syncCart);
      window.clearInterval(interval);
    };
  }, []);

  const { items, total, totalItems } = cartSummary;
  const showStore = Boolean(
    title &&
      title !== config.appNameCommerce &&
      title !== "Loading..." &&
      title !== "Product Not Found",
  );
  const cartUrl = locationCode ? `/${locationCode}/commerce/cart` : "/commerce/cart";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-3 py-3 md:px-6">
        <div className="flex min-h-11 items-center gap-2 md:gap-4">
          <CommerceBrand className="mr-auto md:mr-0" />

          {showStore && (
            openModalInfo ? (
              <button
                type="button"
                onClick={openModalInfo}
                className="hidden h-11 min-w-0 max-w-[220px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-bold text-[#071a4f] transition hover:bg-slate-50 md:flex"
              >
                <StoreIcon className="h-4 w-4 shrink-0 text-[#e30613]" />
                <span className="truncate">{title}</span>
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ) : (
              <Link
                to="/commerce"
                className="hidden h-11 min-w-0 max-w-[220px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-[#071a4f] transition hover:bg-slate-50 md:flex"
              >
                <StoreIcon className="h-4 w-4 shrink-0 text-[#e30613]" />
                <span className="truncate">{title}</span>
              </Link>
            )
          )}

          <SearchBox
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="hidden min-w-[220px] flex-1 md:block"
          />

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle className="h-11 w-11 rounded-md border border-slate-200 bg-white text-[#071a4f] hover:bg-slate-50" />

            {openModalInfo && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={openModalInfo}
                className="h-11 w-11 rounded-md border-slate-200 text-[#071a4f]"
                aria-label="Lihat jam operasional toko"
                title="Jam operasional"
              >
                <CalendarDays className="h-5 w-5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="relative h-11 w-11 rounded-md bg-[#071a4f] p-0 text-white hover:bg-[#102866] md:w-auto md:px-4"
                  aria-label={`Keranjang, ${totalItems} item`}
                >
                  <ShoppingCart className="h-5 w-5" strokeWidth={2.2} />
                  <span className="hidden md:inline">Keranjang</span>
                  {totalItems > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e30613] px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[340px] max-w-[calc(100vw-1.5rem)] rounded-lg border-slate-200 p-0 shadow-xl">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#071a4f]">Keranjang belanja</p>
                      <p className="text-xs text-slate-500">{totalItems} item dipilih</p>
                    </div>
                    {items.length > 0 && (
                      <Link to={cartUrl} className="text-xs font-bold text-[#e30613] hover:underline">
                        Lihat semua
                      </Link>
                    )}
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="px-4 py-9 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">Keranjang masih kosong</p>
                    <p className="mt-1 text-xs text-slate-500">Tambahkan produk dari katalog.</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto px-4">
                      <AnimatePresence initial={false}>
                        {items.slice(0, 5).map((item) => (
                          <motion.div
                            key={item.productId}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="flex items-center gap-3 py-3"
                          >
                            <div className="commerce-product-visual flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200">
                              {item.product.image_url ? (
                                <img src={item.product.image_url} alt="" className="h-10 w-10 object-contain" />
                              ) : (
                                <ShoppingBag className="h-5 w-5 text-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-800">{item.product.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.qty} x {formatCurrency(item.product.price)}</p>
                            </div>
                            <p className="text-sm font-extrabold text-[#071a4f]">{formatCurrency(item.subtotal)}</p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Total</span>
                        <span className="text-base font-extrabold text-[#071a4f]">{formatCurrency(total)}</span>
                      </div>
                      <Button asChild className="h-10 w-full rounded-md bg-[#e30613] font-bold hover:bg-[#c70510]">
                        <Link to={cartUrl}>Lanjut ke checkout</Link>
                      </Button>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 md:hidden">
          {showStore && (
            openModalInfo ? (
              <button
                type="button"
                onClick={openModalInfo}
                className="flex h-10 min-w-0 max-w-[42%] items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-[#071a4f]"
              >
                <StoreIcon className="h-4 w-4 shrink-0 text-[#e30613]" />
                <span className="truncate">{title}</span>
              </button>
            ) : (
              <Link
                to="/commerce"
                className="flex h-10 min-w-0 max-w-[42%] items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-[#071a4f]"
              >
                <StoreIcon className="h-4 w-4 shrink-0 text-[#e30613]" />
                <span className="truncate">{title}</span>
              </Link>
            )
          )}
          <SearchBox
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1"
          />
        </div>
      </div>
    </header>
  );
}
