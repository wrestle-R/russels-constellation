"use client";
import { useEffect, type ReactNode } from "react";
const darkTheme = { theme: "dark" as const };
export const useTheme = () => darkTheme;
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    try {
      localStorage.setItem("play-it-back-theme", "dark");
    } catch {}
  }, []);
  return children;
}
