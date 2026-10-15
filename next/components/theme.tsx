"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { Sun, Moon } from "lucide-react";
type Theme = "light" | "dark";
const Context = createContext<{
  theme: Theme;
  toggle: (button?: HTMLElement) => void;
}>({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(Context);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const reveal = useRef("expand");
  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "light" ? "light" : "dark",
    );
  }, []);
  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("play-it-back-theme", next);
    } catch {}
  }
  function toggle(button?: HTMLElement) {
    const root = document.documentElement;
    if (root.classList.contains("theme-transition")) return;
    const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";
    if (
      !document.startViewTransition ||
      !button ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply(next);
      return;
    }
    const rect = button.getBoundingClientRect(),
      x = rect.left + rect.width / 2,
      y = rect.top + rect.height / 2;
    root.style.setProperty("--theme-transition-x", x + "px");
    root.style.setProperty("--theme-transition-y", y + "px");
    root.style.setProperty(
      "--theme-transition-radius",
      Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) +
        "px",
    );
    root.dataset.themeReveal = reveal.current;
    root.classList.add("theme-transition");
    const cleanup = () => {
      root.classList.remove("theme-transition");
      delete root.dataset.themeReveal;
    };
    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => apply(next));
      });
      transition.finished.then(cleanup, cleanup);
      transition.ready.then(
        () => {
          reveal.current = reveal.current === "expand" ? "contract" : "expand";
        },
        () => {},
      );
    } catch {
      cleanup();
      apply(next);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.key.toLowerCase() !== "d" ||
        target?.closest("input,textarea,select,[contenteditable=true]")
      )
        return;
      e.preventDefault();
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      apply(next);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <Context.Provider value={{ theme, toggle }}>{children}</Context.Provider>
  );
}
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle icon-button"
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      title="Change theme · D"
      onClick={(e) => toggle(e.currentTarget)}
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
