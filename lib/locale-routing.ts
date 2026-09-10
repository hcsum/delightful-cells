import type { Route } from "next";

export const SUPPORTED_LOCALES = ["en", "zh"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE = "cells-locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "en" || value === "zh";
}

export function localeFromPathname(pathname: string | null | undefined): AppLocale {
  const segment = (pathname || "/").split("/")[1];
  return isAppLocale(segment) ? segment : DEFAULT_LOCALE;
}

export function hasLocalePrefix(pathname: string | null | undefined): boolean {
  const segment = (pathname || "/").split("/")[1];
  return isAppLocale(segment);
}

export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split("/");
  if (!isAppLocale(parts[1])) return pathname || "/";
  const rest = `/${parts.slice(2).join("/")}`;
  return rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
}

export function localizePath(pathname: string, locale: AppLocale): Route {
  const bare = stripLocalePrefix(pathname || "/");
  if (locale === DEFAULT_LOCALE) return bare as Route;
  return (bare === "/" ? `/${locale}` : `/${locale}${bare}`) as Route;
}

export function switchLocalePath(pathname: string, locale: AppLocale): Route {
  return localizePath(stripLocalePrefix(pathname || "/"), locale);
}
