import { useMemo, useState } from "react";
import { LogOut, Search, ShoppingBag } from "lucide-react";
import { CommerceBrand } from "@/components/shared/CommerceBrand";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getFilteredNavigation } from "@/lib/navigation";
import { userService } from "@/lib/services/userService";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { user, logout, canRead } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: fullUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => userService.getCurrentUser(),
  });
  const assignedStoresCount = fullUser?.assigned_stores?.length || 0;

  const searchableMenus = useMemo(
    () =>
      getFilteredNavigation(assignedStoresCount).flatMap((group) =>
        group.listMenus.filter((item) => {
          if (!canRead(item.key)) return false;
          return group.role !== "super_admin" || user?.role === "super_admin";
        }),
      ),
    [assignedStoresCount, canRead, user?.role],
  );

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("id-ID");
    if (!normalizedQuery) return [];

    return searchableMenus
      .filter(
        (item) =>
          item.label.toLocaleLowerCase("id-ID").includes(normalizedQuery) ||
          item.path.toLocaleLowerCase("id-ID").includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [searchQuery, searchableMenus]);

  const handleLogout = () => {
    logout();
    toast.success("Logout berhasil");
    navigate("/auth/sign-in", { replace: true });
  };

  const handleNavigate = (path: string) => {
    setSearchQuery("");
    setSearchOpen(false);
    navigate(path);
  };

  const userInitial = user?.username?.charAt(0).toUpperCase() || "U";

  return (
    <header className="admin-topbar sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <CommerceBrand
        compact
        to="/dashboard"
        ariaLabel="AMP Mart Admin, buka dashboard"
        className="shrink-0 md:hidden"
      />

      <div className="min-w-0 shrink sm:w-44 lg:w-52">
        <h1 className="truncate text-sm font-extrabold text-foreground sm:text-base">{title}</h1>
        <p className="hidden truncate text-[11px] font-semibold text-muted-foreground sm:block">AMP Mart Admin</p>
      </div>

      <div
        className="relative hidden min-w-[220px] max-w-xl flex-1 sm:block"
        onFocusCapture={() => setSearchOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
        }}
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && searchResults[0]) {
              event.preventDefault();
              handleNavigate(searchResults[0].path);
            }
            if (event.key === "Escape") setSearchOpen(false);
          }}
          placeholder="Cari menu..."
          className="h-10 rounded-md border-border bg-secondary pl-9 font-medium focus-visible:bg-card"
          role="combobox"
          aria-label="Cari menu"
          aria-expanded={searchOpen && Boolean(searchQuery.trim())}
          aria-controls="admin-menu-search-results"
          aria-autocomplete="list"
        />

        {searchOpen && searchQuery.trim() && (
          <div
            id="admin-menu-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-12 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
          >
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => handleNavigate(item.path)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.path}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground">Menu tidak ditemukan.</p>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-10 rounded-md border-[#071a4f]/20 font-bold text-[#071a4f] hover:bg-[#071a4f] hover:text-white dark:text-foreground lg:inline-flex"
          onClick={() => navigate("/commerce")}
        >
          <ShoppingBag className="mr-2 h-4 w-4" aria-hidden="true" />
          Buka katalog
        </Button>

        <ThemeToggle className="h-10 w-10 rounded-md border border-border bg-card text-[#071a4f] dark:text-foreground" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-md px-1.5 hover:bg-muted sm:pr-2.5"
              aria-label="Buka menu pengguna"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#071a4f] text-sm font-bold text-white dark:bg-[#e30613]">
                {userInitial}
              </span>
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-28 truncate text-xs font-medium text-foreground">{user?.username}</span>
                <span className="block max-w-28 truncate text-[11px] capitalize text-muted-foreground">
                  {user?.role?.replace(/_/g, " ")}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-md">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium text-foreground">{user?.username}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
