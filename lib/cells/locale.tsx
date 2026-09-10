"use client";

// Client-side locale context. CellsApp provides it; every cells component
// reads it through useT(). Server components use t() from i18n.ts directly.

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { t, type Locale } from "./i18n";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  hasLocalePrefix,
  isAppLocale,
  localeFromPathname,
  switchLocalePath,
} from "@/lib/locale-routing";

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
export function useStoredLocale(initialLocale: Locale = DEFAULT_LOCALE): [Locale, (next: Locale) => void] {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const routeLocale = localeFromPathname(pathname);
    if (hasLocalePrefix(pathname)) {
      setLocale(routeLocale);
      persistLocale(routeLocale);
      return;
    }

    let saved: string | null = null;
    try { saved = localStorage.getItem("cells-locale"); } catch {}
    const next = isAppLocale(saved)
      ? saved
      : navigator.language?.toLowerCase().startsWith("zh")
        ? "zh"
        : DEFAULT_LOCALE;
    setLocale(next);
    persistLocale(next);
    if (next !== DEFAULT_LOCALE) {
      router.replace(switchLocalePath(pathname, next));
    }
  }, [pathname, router]);

  const switchLocale = (next: Locale) => {
    setLocale(next);
    persistLocale(next);
    const search = typeof window === "undefined" ? "" : window.location.search;
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    router.push(`${switchLocalePath(pathname, next)}${search}${hash}` as any);
  };

  return [locale, switchLocale];
}

function persistLocale(locale: Locale) {
  try { localStorage.setItem("cells-locale", locale); } catch {}
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {}
}
