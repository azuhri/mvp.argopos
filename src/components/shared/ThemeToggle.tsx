import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_STORAGE_KEY = "theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        // Read from localStorage first
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme) {
          return savedTheme === "dark";
        }
        // Fallback to system preference
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      } catch {
        // Fallback to DOM class
        return document.documentElement.classList.contains("dark");
      }
    }
    return false;
  });

  useEffect(() => {
    // Update DOM classes
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.transition = "background-color 0.5s ease, color 0.3s ease";
    
    // Save to localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
      } catch {
        // Silent fail for localStorage issues
      }
    }
  }, [dark]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if user hasn't manually set a preference
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          setDark(e.matches);
        }
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, []);

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
