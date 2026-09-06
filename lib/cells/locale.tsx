"use client";

// Client-side locale context. CellsApp provides it; every cells component
// reads it through useT(). Server components use t() from i18n.ts directly.

import { createContext, useContext, useEffect, useState } from "react";
import { t, type Locale } from "./i18n";

export const LocaleContext = createContext<Locale>("en");

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useContext(LocaleContext);
  return (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);
}

// Same rule CellsApp uses: a saved choice wins, otherwise follow the browser.
// Pages outside CellsApp (pricing, account) call this and provide the context
// themselves, so the language toggle carries across the whole site.
export function useStoredLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("cells-locale"); } catch {}
    if (saved === "zh" || saved === "en") setLocale(saved);
    else if (navigator.language?.toLowerCase().startsWith("zh")) setLocale("zh");
  }, []);
  const switchLocale = (next: Locale) => {
    setLocale(next);
    try { localStorage.setItem("cells-locale", next); } catch {}
  };
  return [locale, switchLocale];
}
