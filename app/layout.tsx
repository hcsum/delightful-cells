import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

// Use default runtime; OpenNext will generate the Worker wrapper

const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://delightfulcells.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),

  title: {
    default: "Extract, summerize, classify, compare columns in Excel with AI",
    template: "%s | Excel Data Tools",
  },

  description:
    "Extract, summarize, classify data from Excel or CSV files. Find duplicates, compare columns. Built for one-off cleanup tasks — upload, preview, and download results in seconds. Get jobs done without fighting Excel settings and formulas.",

  keywords: [
    // High-volume core
    "find duplicates in excel",
    "compare columns in excel",
    "compare two columns excel",
    "excel duplicate finder",
    "excel compare columns",

    // CSV & extraction
    "extract data from excel",
    "extract text from excel",
    "excel csv tool",
    "csv data cleanup",

    // AI as capability (not primary intent)
    "ai for excel",
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
