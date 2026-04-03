"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";

export type DashboardTheme = "dark" | "light";

type ContextValue = {
  theme: DashboardTheme;
  setTheme: (theme: DashboardTheme) => void;
  toggleTheme: () => void;
};

const DashboardThemeContext = createContext<ContextValue | null>(null);

export function useDashboardTheme(): ContextValue {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  return ctx;
}

interface DashboardThemeProviderProps {
  children: React.ReactNode;
  /** Optional: apply theme class and layout styles to this wrapper (so layout is theme-aware) */
  className?: string;
  /** Forwarded to the wrapper div — use for row flex layout so the shell works if Tailwind/CSS fails to load */
  style?: React.CSSProperties;
}

export function DashboardThemeProvider({ children, className = "", style }: DashboardThemeProviderProps) {
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resolve to "light" | "dark" for dashboard; avoid flash by defaulting to dark until mounted
  const effectiveTheme: DashboardTheme =
    mounted && resolvedTheme === "light" ? "light" : "dark";

  const setTheme = useCallback(
    (next: DashboardTheme) => {
      setNextTheme(next);
    },
    [setNextTheme]
  );

  const toggleTheme = useCallback(() => {
    setNextTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [setNextTheme, resolvedTheme]);

  return (
    <DashboardThemeContext.Provider value={{ theme: effectiveTheme, setTheme, toggleTheme }}>
      <div
        className={className}
        style={style}
        data-theme={effectiveTheme}
        suppressHydrationWarning
      >
        {children}
      </div>
    </DashboardThemeContext.Provider>
  );
}
