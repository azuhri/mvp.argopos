import { Search, Bell, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logout berhasil");
    navigate("/auth/sign-in", { replace: true });
  };

  const getUserInitial = () => {
    if (!user) return "U";
    return user.name.charAt(0).toUpperCase();
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border/40 glass-strong sticky top-0 z-30">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9 w-56 h-9 bg-secondary/50 border-border/50 focus:bg-card"
          />
        </div>

        <button className="relative h-9 w-9 rounded-lg flex items-center justify-center bg-secondary hover:bg-accent transition-colors btn-tap">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-lg bg-primary/10 hover:bg-primary/20">
              <span className="text-sm font-semibold text-primary">{getUserInitial()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
