import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: ResolvedTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePreference;
  switchable?: boolean;
}

const systemTheme = (): ResolvedTheme => window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const resolveTheme = (preference: ThemePreference): ResolvedTheme => preference === "system" ? systemTheme() : preference;

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (switchable) {
      const previewTheme = new URLSearchParams(window.location.search).get("theme");
      if (previewTheme === "system" || previewTheme === "light" || previewTheme === "dark") return previewTheme;
      const stored = localStorage.getItem("theme");
      return (stored as ThemePreference) || defaultTheme;
    }
    return defaultTheme;
  });
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const sync = () => setTheme(resolveTheme(preference));
    sync();
    if (preference === "system" && media) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
  }, [preference]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", preference);
    }
  }, [theme, preference, switchable]);

  const toggleTheme = switchable
    ? () => {
        setPreference(prev => resolveTheme(prev) === "light" ? "dark" : "light");
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
