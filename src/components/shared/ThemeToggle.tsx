import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.transition = "background-color 0.5s ease, color 0.3s ease";
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className={cn(
        "relative h-9 w-9 rounded-lg flex items-center justify-center",
        "bg-secondary hover:bg-accent transition-colors duration-300 btn-tap",
        className
      )}
      aria-label="Toggle theme"
    >
      <Sun className={cn("h-4 w-4 absolute transition-all duration-300", dark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100")} />
      <Moon className={cn("h-4 w-4 absolute transition-all duration-300", dark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0")} />
    </button>
  );
}
