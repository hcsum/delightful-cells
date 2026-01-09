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

      {/* Usage guide, mirroring the pattern used on Extract and Find Duplicates */}
      <div className="space-y-8 pt-12">
        <hr />
        {/* How to Use */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>
              <strong>Enter Column A and Column B:</strong> Type the header
              names you want to compare.
            </li>
            <li>
              <strong>Choose comparison type:</strong> Select{" "}
              <em>duplicates</em>, <em>matches</em>, or <em>missing items</em>.
            </li>
            <li>
              <strong>Choose case sensitivity (optional):</strong> Leave off to
              compare case-insensitively; turn on to make comparisons
              case-sensitive.
            </li>
            <li>
              <strong>Upload CSV:</strong> Select your .csv file (up to 20 MB
              and 5,000 data rows). All processing happens in your browser.
            </li>
            <li>
              <strong>Process and download:</strong> Click Process CSV to
              download a copy with a new comparison column appended.
            </li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
        <section className="space-y-12">
          {/* Example — duplicates mode */}
          <article className="space-y-3">
            <h3 className="text-lg font-medium">
              Example — Duplicates (A exists in B)
            </h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>Target:</strong> duplicates flag (True when the
                normalized value from Column A exists anywhere in Column B)
              </li>
              <li>
                <strong>Source:</strong> order_number_entered →
                order_number_master
              </li>
            </ul>
            <div className="space-y-2">
              <div>Expected output:</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        order_number_entered
                      </th>
                      <th className="border-b border-white/10 py-1 pr-4">
                        order_number_master
                      </th>
                      <th className="border-b border-white/10 py-1">
                        duplicates_order_number_entered_order_number_master
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top pr-4 py-1">1001</td>
                      <td className="align-top pr-4 py-1">AC105</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1002</td>
                      <td className="align-top pr-4 py-1">AC106</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1003</td>
                      <td className="align-top pr-4 py-1">AC107</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top pr-4 py-1">1001</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1005</td>
                      <td className="align-top pr-4 py-1">AC109</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1006</td>
                      <td className="align-top pr-4 py-1">AC110</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1007</td>
                      <td className="align-top pr-4 py-1">1002</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          {/* Example — matches mode */}
          <article className="space-y-3">
            <h3 className="text-lg font-medium">
              Example — Matches (A equals B in the same row)
            </h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>Target:</strong> matches flag (True when the normalized
                values of Column A and Column B are equal in the same row)
              </li>
              <li>
                <strong>Source:</strong> order_number_entered →
                order_number_master
              </li>
            </ul>
            <div className="space-y-2">
              <div>Expected output:</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        order_number_entered
                      </th>
                      <th className="border-b border-white/10 py-1 pr-4">
                        order_number_master
                      </th>
                      <th className="border-b border-white/10 py-1">
                        matches_order_number_entered_order_number_master
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top pr-4 py-1">1001</td>
                      <td className="align-top pr-4 py-1">1001</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1002</td>
                      <td className="align-top pr-4 py-1">1002</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1003</td>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1005</td>
                      <td className="align-top pr-4 py-1"></td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1006</td>
                      <td className="align-top pr-4 py-1">1006</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1007</td>
                      <td className="align-top pr-4 py-1">1008</td>
                      <td className="align-top py-1"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          {/* Example — missing items mode */}
          <article className="space-y-3">
            <h3 className="text-lg font-medium">
              Example — Missing Items (A not found anywhere in B)
            </h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>Target:</strong> missing items flag (True when the
                normalized value from Column A does not appear anywhere in
                Column B)
              </li>
              <li>
                <strong>Source:</strong> order_number_entered →
                order_number_master
              </li>
            </ul>
            <div className="space-y-2">
              <div>Expected output:</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        order_number_entered
                      </th>
                      <th className="border-b border-white/10 py-1 pr-4">
                        order_number_master
                      </th>
                      <th className="border-b border-white/10 py-1">
                        missing_items_order_number_entered_order_number_master
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top pr-4 py-1">1001</td>
                      <td className="align-top pr-4 py-1">1001</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1002</td>
                      <td className="align-top pr-4 py-1">1002</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1003</td>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top pr-4 py-1">1004</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1005</td>
                      <td className="align-top pr-4 py-1"></td>
                      <td className="align-top py-1">True</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1006</td>
                      <td className="align-top pr-4 py-1">1006</td>
                      <td className="align-top py-1"></td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">1007</td>
                      <td className="align-top pr-4 py-1">1008</td>
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
