"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch {}
    setTheme(stored === "light" || stored === "dark" ? stored : systemTheme());

    // Sin preferencia guardada, seguir los cambios del sistema/navegador.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let s: string | null = null;
      try { s = localStorage.getItem(KEY); } catch {}
      if (s !== "light" && s !== "dark") {
        const t = systemTheme();
        apply(t);
        setTheme(t);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try { localStorage.setItem(KEY, next); } catch {}
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo oscuro (clic para claro)" : "Modo claro (clic para oscuro)"}
      onClick={toggle}
      suppressHydrationWarning
    >
      <span className="theme-toggle-track" data-on={theme === null ? undefined : isDark}>
        <span className="theme-toggle-thumb">
          {isDark ? (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          )}
        </span>
      </span>
    </button>
  );
}
