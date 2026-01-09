import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import HeaderAuth from "@/components/HeaderAuth";

// Use default runtime; OpenNext will generate the Worker wrapper

// Set absolute site URL based on NODE_ENV (no env var needed)
const appUrl =
  process.env.NODE_ENV === "production"
    ? "https://extractfromexcel.com"
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),

  title: {
    default: "Find Duplicates & Compare Columns in Excel (Fast & Simple)",
    template: "%s | Excel Data Tools",
  },

  description:
    "Find duplicates in Excel, compare two columns for missing items, and extract or summarize data from Excel or CSV files. Built for one-off cleanup tasks — upload, preview, and download results in seconds.",

  keywords: [
    // High-volume core
    "find duplicates in excel",
    "compare columns in excel",
    "compare two columns excel",
    "excel duplicate finder",
    "excel compare columns",

    // Supporting / long-tail
    "missing items in excel",
    "remove duplicates excel",
    "excel data cleanup",
    "clean excel data",
    "one-off excel tasks",

    // CSV & extraction
    "extract data from excel",
    "extract text from excel",
    "excel csv tool",
    "csv data cleanup",

    // AI as capability (not primary intent)
    "ai excel tool",
    "excel ai data extraction",
  ],

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-white/10">
          <div className="container flex items-center justify-between">
            <Link href="/" className="font-semibold text-muted">
              Excel CSV AI Extractor
            </Link>
            <div className="flex items-center gap-4 md:gap-8 lg:gap-10 text-sm text-white/70 text-muted">
              <Link
                href="/extract-text-from-cell-excel"
                className="hidden md:inline hover:underline"
              >
                Extract Text
              </Link>
              <Link
                href="/compare-two-columns-in-excel"
                className="hidden md:inline hover:underline"
              >
                Compare columns
              </Link>
              <Link
                href="/find-duplicates-in-excel"
                className="hidden md:inline hover:underline"
              >
                Find duplicates
              </Link>
              {/* Tutorial link removed */}
              <ThemeToggle />
              <HeaderAuth />
            </div>
          </div>
        </header>
        <main className="container pb-24">{children}</main>
        <footer className="container text-xs text-white/60 py-8 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-end gap-4">
            {/* Tutorial link removed */}
            <Link href="/terms" className="underline hover:no-underline">
              Terms of Service
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
