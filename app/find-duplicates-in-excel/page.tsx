import DuplicateFinderClient from "@/components/DuplicateFinderClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Duplicates in Excel (CSV Tool)",
  description:
    "Upload a CSV and flag duplicate values within a single column. Supports up to 20 MB and 5,000 rows.",
  alternates: { canonical: "/find-duplicates-in-excel" },
  openGraph: {
    title: "Find Duplicates in Excel",
    description:
      "Detect duplicate values in a chosen column of your CSV/Excel file. No uploads, processed in your browser.",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Find Duplicates in Excel",
    description:
      "Flag duplicate values within one column of a CSV/Excel file. Client-side only.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Find Duplicates in Excel</h1>
      <p className="text-white/80 max-w-2xl text-muted">
        Choose a column and flag duplicate values within that column. By default
        comparisons are case-insensitive. Upload a CSV and download the result
        with one extra column.
      </p>
      <DuplicateFinderClient />
    </div>
  );
}
