"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Site chrome (header/main.container/footer) extracted from the root layout.
// Full-bleed experiences (the Delightful Cells homepage) opt out entirely.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname?.startsWith("/cells")) {
    return <>{children}</>;
  }
  return (
    <>
      <header className="border-b border-black/10 bg-[#fffaf0]">
        <div className="container flex items-center justify-between">
          <Link href="/" title="Delightful Cells" className="font-extrabold !text-black">
            Delightful{" "}
            <span className="bg-gradient-to-r from-[#ff0080] via-[#ff8c00] to-[#7c4dff] bg-clip-text text-transparent">
              Cells
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/extract-text-from-cell-excel"
              title="Extract Text"
              className="hidden md:inline rounded-full px-3 py-1 font-semibold !text-black/60 hover:bg-[#fff3d6]"
            >
              Extract Text
            </Link>
            <Link
              href="/compare-two-columns-in-excel"
              title="Compare columns"
              className="hidden md:inline rounded-full px-3 py-1 font-semibold !text-black/60 hover:bg-[#fff3d6]"
            >
              Compare columns
            </Link>
            <Link
              href="/find-duplicates-in-excel"
              title="Find duplicates"
              className="hidden md:inline rounded-full px-3 py-1 font-semibold !text-black/60 hover:bg-[#fff3d6]"
            >
              Find duplicates
            </Link>
          </nav>
        </div>
      </header>
      <main className="container pb-24">{children}</main>
      <footer className="container text-xs text-black/50 py-8 border-t border-black/10">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <a
            href="https://mossai.org"
            title="MossAI Tools"
            className="underline hover:no-underline !text-black/50"
          >
            MossAI Tools
          </a>
          <Link
            href="/terms"
            title="Terms of Service"
            className="underline hover:no-underline !text-black/50"
          >
            Terms of Service
          </Link>
        </div>
      </footer>
    </>
  );
}
