"use client";

// Client-side locale context. CellsApp provides it; every cells component
// reads it through useT(). Server components use t() from i18n.ts directly.

import { createContext, useContext } from "react";
import { t, type Locale } from "./i18n";

export const LocaleContext = createContext<Locale>("en");

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useContext(LocaleContext);
  return (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);
}
