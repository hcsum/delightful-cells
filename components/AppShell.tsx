"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/HeaderAuth";
import { LocaleContext, useStoredLocale } from "@/lib/cells/locale";
import { localizePath, stripLocalePrefix, type AppLocale } from "@/lib/locale-routing";

// Site chrome (header/main.container/footer) extracted from the root layout.
// Full-bleed experiences (the Delightful Cells homepage) opt out entirely.
export default function AppShell({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: AppLocale;
}) {
  const pathname = usePathname();
  const [locale, setLocale] = useStoredLocale(initialLocale);
  const barePathname = stripLocalePrefix(pathname || "/");
  const labels = locale === "zh"
    ? { credits: "额度", terms: "服务条款" }
    : { credits: "Credits", terms: "Terms of Service" };

  if (barePathname === "/" || barePathname.startsWith("/cells")) {
    return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
  }

  return (
    <LocaleContext.Provider value={locale}>
      <header className="border-b border-black/10 bg-[#fffaf0]">
        <div className="container flex items-center justify-between">
          <Link href={localizePath("/", locale)} title="Delightful Cells" className="font-extrabold !text-black">
            Delightful{" "}
            <span className="bg-gradient-to-r from-[#ff0080] via-[#ff8c00] to-[#7c4dff] bg-clip-text text-transparent">
              Cells
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href={localizePath("/pricing", locale)}
              title={labels.credits}
              className="rounded-full px-3 py-1 font-semibold !text-black/60 hover:bg-[#fff3d6]"
            >
              {labels.credits}
            </Link>
            <button
              type="button"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              className="rounded-full border !border-black/15 bg-white px-3 py-1 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
            >
              {locale === "zh" ? "EN" : "中文"}
            </button>
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main className="container pb-24">{children}</main>
      <footer className="container text-xs text-black/50 py-8 border-t border-black/10">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <Link
            href={localizePath("/pricing", locale)}
            title={labels.credits}
            className="underline hover:no-underline !text-black/50"
          >
            {labels.credits}
          </Link>
          <Link
            href={localizePath("/terms", locale)}
            title={labels.terms}
            className="underline hover:no-underline !text-black/50"
          >
            {labels.terms}
          </Link>
        </div>
      </footer>
    </LocaleContext.Provider>
  );
}
