import CompareColumnsClient from "@/components/CompareColumnsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Two Columns in Excel",
  description:
    "Compare two Excel columns to find duplicates or missing items. Upload a CSV and get a clean, downloadable result in seconds.",
  alternates: { canonical: "/compare-two-columns-in-excel" },
  openGraph: {
    title: "Compare Two Columns in Excel",
    description:
      "Compare two Excel columns to find duplicates or missing items. Upload a CSV and get a clean, downloadable result in seconds.",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Compare Two Columns in Excel",
    description:
      "Compare two Excel columns to find duplicates or missing items. Upload a CSV and get a clean, downloadable result in seconds.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Compare Two Columns in Excel</h1>
      <p className="text-white/80 max-w-2xl text-muted">
        This tool helps you compare two columns to identify duplicates or
        missing values. Just upload a CSV, select the columns, and get a
        processed file with a clear comparison result added.
      </p>
      <CompareColumnsClient />
    </div>
  );
}
