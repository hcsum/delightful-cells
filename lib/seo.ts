import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  localizePath,
  type AppLocale,
} from "@/lib/locale-routing";

// The locale the middleware resolved for this request. Every page is a server
// component, so this is the only place that needs to know how it travels.
export async function serverLocale(): Promise<AppLocale> {
  const localeHeader = (await headers()).get("x-locale");
  return isAppLocale(localeHeader) ? localeHeader : DEFAULT_LOCALE;
}

export type LocalizedCopy = { title: string; description: string };

// /x, /zh/x, and /ja/x are the same file rendered for each locale. Without these tags a crawler
// sees two URLs with the same content and no statement of which is which, so
// it picks one and drops the other — and the sitemap's hreflang alone never
// said it on the page itself.
export function localeAlternates(path: string, locale: AppLocale) {
  return {
    canonical: localizePath(path, locale),
    languages: {
      en: localizePath(path, "en"),
      "zh-CN": localizePath(path, "zh"),
      ja: localizePath(path, "ja"),
      "x-default": localizePath(path, "en"),
    },
  };
}

// Builds the head for a page that exists in both locales. `extra` wins over the
// defaults, so a page with its own og:image passes it through.
export async function localizedMetadata(
  path: string,
  copy: Record<AppLocale, LocalizedCopy>,
  extra?: Metadata,
): Promise<Metadata> {
  const locale = await serverLocale();
  const { title, description } = copy[locale];
  return {
    title,
    description,
    alternates: localeAlternates(path, locale),
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
    ...extra,
  };
}
