"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "dashboard-theme";

export type DashboardTheme = "dark" | "light";

type ContextValue = {
  theme: DashboardTheme;
  setTheme: (theme: DashboardTheme) => void;
  toggleTheme: () => void;
};

const DashboardThemeContext = createContext<ContextValue | null>(null);

function readStoredTheme(): DashboardTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (_) {}
  return "dark";
}

export function useDashboardTheme(): ContextValue {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  return ctx;
}

interface DashboardThemeProviderProps {
  children: React.ReactNode;
  /** Optional: apply theme class and layout styles to this wrapper (so layout is theme-aware) */
  className?: string;
}

export function DashboardThemeProvider({ children, className = "" }: DashboardThemeProviderProps) {
  const [theme, setThemeState] = useState<DashboardTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: DashboardTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {}
      return next;
    });
  }, []);

  // Avoid flash: once mounted, use stored theme; before that use default dark
  const effectiveTheme = mounted ? theme : "dark";
  // Tailwind darkMode: ["class"] — add "dark" to html so ALL descendants (including portaled content) get dark: variants
  const themeClass = effectiveTheme === "dark" ? "dark" : "";

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (themeClass) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    return () => {
      root.classList.remove("dark");
    };
  }, [mounted, themeClass]);

  return (
    <DashboardThemeContext.Provider value={{ theme: effectiveTheme, setTheme, toggleTheme }}>
      <div
        className={`${themeClass} ${className}`.trim()}
        data-theme={effectiveTheme}
        suppressHydrationWarning
      >
        {children}
      </div>
    </DashboardThemeContext.Provider>
  );
}
