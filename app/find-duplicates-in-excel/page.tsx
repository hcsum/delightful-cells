import DuplicateFinderClient from "@/components/DuplicateFinderClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Duplicates in Excel (Excel & CSV Tool)",
  description:
    "Upload an Excel file (.xlsx) or CSV and flag duplicate values within a single column. Supports files up to 20 MB.",
  alternates: { canonical: "/find-duplicates-in-excel" },
  openGraph: {
    title: "Find Duplicates in Excel",
    description:
      "Detect duplicate values in a chosen column of your Excel or CSV file.",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Find Duplicates in Excel",
    description: "Flag duplicate values within one column of an Excel or CSV file.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Find Duplicates in Excel</h1>
      <p className="text-white/80 max-w-2xl text-muted">
        Choose a column and flag duplicate values within that column. By default
        comparisons are case-insensitive. Upload an Excel file and download the result
        with one extra column.
      </p>
      <DuplicateFinderClient />

      {/* Usage guide, following the pattern used on the Extract page */}
      <div className="space-y-8 pt-12">
        <hr />
        {/* How to Use */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>
              <strong>Upload your file:</strong> Select an .xlsx, .xls, or .csv
              file — no need to convert it first. If the workbook has several
              sheets, pick the one you want.
            </li>
            <li>
              <strong>Pick the column:</strong> Choose it from the dropdown of
              your file&apos;s own headers — nothing to type.
            </li>
            <li>
              <strong>Choose case sensitivity (optional):</strong> Leave off to
              compare case-insensitively; turn on to make comparisons
              case-sensitive.
            </li>
            <li>
              <strong>Process and download:</strong> You get a copy in the same
              format you uploaded, with a new duplicates column appended.
            </li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
        <section className="space-y-12">
          <article className="space-y-3">
            <h3 className="text-lg font-medium">
              Example — Find duplicate emails
            </h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>Target:</strong> duplicates flag (True when the
                normalized value occurs more than once)
              </li>
              <li>
                <strong>Source:</strong> email
              </li>
            </ul>
            <div className="space-y-2">
              <div>Expected output:</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        email
                      </th>
                      <th className="border-b border-white/10 py-1">
                        duplicates_email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top pr-4 py-1">alice@example.com</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">bob@example.com</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">alice@example.com</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">carol@company.co</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">BOB@example.com</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
