import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tutorial: How to Use the Extract Text from Cell Tool',
  description:
    'Learn how to upload a CSV or paste sample rows, choose the source column, describe what to extract, preview a few rows, then process the full file and download your results.',
  alternates: { canonical: '/tutorial' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Tutorial: How to Use the Extract Text from Cell Tool',
    description:
      'Step-by-step guide to extracting structured data from a single column in your CSV or Excel file with AI.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Tutorial: How to Use the Extract Text from Cell Tool',
    description: 'Step-by-step usage guide with examples and expected outputs.',
  },
}

export default function TutorialPage() {
  return (
    <div className="space-y-8">
      {/* 1) Short introduction */}
      <section id="extract-text" className="space-y-3">
        <h1 className="text-2xl font-semibold">Tutorial: Extract Text from a Single Column</h1>
        <p className="text-white/80 text-muted max-w-3xl">
          This tutorial shows how to use the tool on the{' '}
          <Link href="/extract-text-from-cell-excel" className="underline hover:no-underline">Extract Text from Cell</Link>{' '}
          page. You can upload a CSV or paste sample rows, define what text you want to extract and from which column,
          preview a few rows, then process the full file and download structured results.
        </p>
      </section>

      {/* Outline / On this page */}
      <nav aria-label="Tutorial outline" className="space-y-2">
        <h2 className="text-xl font-semibold">On This Page</h2>
        <ul className="list-disc pl-6 text-white/80">
          <li>
            <a href="#extract-text" className="underline hover:no-underline">Extract Text from a Single Column</a>
          </li>
          <li>
            <a href="#find-duplicates" className="underline hover:no-underline">Find Duplicates in a Single Column</a>
          </li>
          <li>
            <a href="#compare-columns" className="underline hover:no-underline">Compare Two Columns</a>
          </li>
        </ul>
      </nav>

      {/* 2) Step-by-step guide */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Step-by-Step Usage</h2>
        <ol className="list-decimal pl-6 space-y-2 text-white/80">
          <li>
            <strong>Upload or paste CSV:</strong> Drag in a CSV file (or paste a few sample rows) so the tool can read your headers
            and data.
          </li>
          <li>
            <strong>Choose the Source column:</strong> Select the column that contains the text you want to extract from.
          </li>
          <li>
            <strong>Define the Target:</strong> Describe the target information in plain English (for example, "US state as a
            two-letter code" or "domain from email").
          </li>
          <li>
            <strong>Preview sample rows:</strong> Run a short preview to check the output on a handful of rows and adjust the
            description if needed.
          </li>
          <li>
            <strong>Process full file and download results:</strong> When you are happy with the preview, process the full CSV and
            download the result.
          </li>
        </ol>
      </section>

      {/* 3) Explain Target vs Source */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Key Terms: Target and Source</h2>
        <div className="space-y-2 text-white/80">
          <p>
            <code className="px-1 rounded bg-white/10">Target</code> describes what you want as output. It is a short, plain-English
            instruction, such as "domain from email", "US state abbreviation", or "all numeric values".
          </p>
          <p>
            <code className="px-1 rounded bg-white/10">Source</code> is the name of the column in your CSV to read from, such as
            <em> email</em>, <em> address</em>, or <em> text</em>. In the UI, this corresponds to the "Source column" you select from the
            dropdown.
          </p>
          <p>
            Together, Target and Source tell the tool <em>what</em> to extract and <em>where</em> to extract it from.
          </p>
        </div>
      </section>

      {/* 4 & 5) Three complete examples with CSV + expected outputs */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Examples</h2>

        {/* Example A */}
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example A - Summary category extraction</h3>
          <p className="text-white/80 max-w-3xl">
            Goal: produce a short category that summarizes the main problem in each feedback comment.
          </p>
          <div>
            <div className="text-sm text-white/70">CSV input</div>
            <pre className="mt-1 rounded border border-white/10 bg-white/5 p-3 overflow-auto text-sm"><code>{`feedback
"App crashes when uploading large files"
"Page is slow to load on mobile"
"Login step is confusing"
"Too many steps to export CSV"`}</code></pre>
          </div>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> a short summary of the main problem in one or two words</li>
            <li><strong>Source:</strong> feedback</li>
          </ul>
          <div className="space-y-2">
            <div className="text-sm text-white/70">Expected output structure</div>
            <p className="text-white/80 text-sm">A new column such as <em>summary</em> with a short label (e.g., "crash", "performance", "usability", "workflow").</p>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">feedback</th>
                    <th className="border-b border-white/10 py-1">summary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">App crashes when uploading large files</td>
                    <td className="align-top py-1">crash</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Page is slow to load on mobile</td>
                    <td className="align-top py-1">performance</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Login step is confusing</td>
                    <td className="align-top py-1">usability</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Too many steps to export CSV</td>
                    <td className="align-top py-1">workflow</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>

        {/* Example B */}
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example B - Extract email domain</h3>
          <div>
            <div className="text-sm text-white/70">CSV input</div>
            <pre className="mt-1 rounded border border-white/10 bg-white/5 p-3 overflow-auto text-sm"><code>{`email
alice@example.com
bob@company.co.uk
"carol+sales@my-site.io"`}</code></pre>
          </div>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> domain from email</li>
            <li><strong>Source:</strong> email</li>
          </ul>
          <div className="space-y-2">
            <div className="text-sm text-white/70">Expected output structure</div>
            <p className="text-white/80 text-sm">A new column <em>domain</em> with values like:</p>
            <ul className="list-disc pl-6 text-white/80 text-sm space-y-1">
              <li>example.com</li>
              <li>company.co.uk</li>
              <li>my-site.io</li>
            </ul>
          </div>
        </article>

        {/* Example C */}
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example C - Excel extract number from string</h3>
          <p className="text-white/80 max-w-3xl">
            This example mirrors the excel extract number from string task: given mixed text, pull all digits and decimals from a single column.
            For a focused walkthrough, see our dedicated page: <Link href="/excel-extract-number-from-string" className="underline hover:no-underline">excel extract number from string</Link>.
          </p>
          <div>
            <div className="text-sm text-white/70">CSV input</div>
            <pre className="mt-1 rounded border border-white/10 bg-white/5 p-3 overflow-auto text-sm"><code>{`text
"Invoice #4453 total: $129.50 (2 items)"
"Qty 3 - Ref 88-204, price 9.99"
"no numbers here"
"Order 5821 / 12 units / lot A"`}</code></pre>
          </div>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> all numeric values</li>
            <li><strong>Source:</strong> text</li>
          </ul>
          <div className="space-y-2">
            <div className="text-sm text-white/70">Expected output structure</div>
            <p className="text-white/80 text-sm">A new column such as <em>numbers</em> listing the values found in each row:</p>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">text</th>
                    <th className="border-b border-white/10 py-1">numbers</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">Invoice #4453 total: $129.50 (2 items)</td>
                    <td className="align-top py-1">4453, 129.50, 2</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Qty 3 - Ref 88-204, price 9.99</td>
                    <td className="align-top py-1">3, 88, 204, 9.99</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">no numbers here</td>
                    <td className="align-top py-1">(none)</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Order 5821 / 12 units / lot A</td>
                    <td className="align-top py-1">5821, 12</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>

      {/* New: Find duplicates in a single column */}
      <section id="find-duplicates" className="space-y-3">
        <h2 className="text-xl font-semibold">Find Duplicates in a Single Column</h2>
        <p className="text-white/80 text-muted max-w-3xl">
          To flag duplicates within one column, use the{' '}
          <Link href="/find-duplicates-in-excel" className="underline hover:no-underline">Find Duplicates in Excel</Link>{' '}
          page. Upload a CSV, enter the column name (header), and download a new file with a duplicates column added.
        </p>
        <div>
          <div className="text-sm text-white/70">CSV input</div>
          <pre className="mt-1 rounded border border-white/10 bg-white/5 p-3 overflow-auto text-sm"><code>{`email
alice@example.com
bob@example.com
alice@example.com
carol@company.co
BOB@example.com`}</code></pre>
        </div>
        <ul className="text-white/80 text-sm space-y-1">
          <li><strong>Column:</strong> email</li>
          <li><strong>Case sensitivity:</strong> Case-insensitive by default (toggle available). Checking the toggle makes comparisons case-sensitive.</li>
          <li><strong>Blanks:</strong> Empty values are ignored when computing duplicates.</li>
          <li><strong>Limits:</strong> Up to 5,000 data rows (20 MB CSV).</li>
          <li><strong>Privacy:</strong> Runs entirely in your browser; no data upload.</li>
        </ul>
        <p className="text-white/70 text-sm">
          The download preserves original columns and adds <code className="mx-1 px-1 rounded bg-white/10">duplicates_email</code>,
          marked <em>True</em> for rows whose normalized value occurs more than once.
        </p>
      </section>

      {/* New: Compare two columns feature */}
      <section id="compare-columns" className="space-y-3">
        <h2 className="text-xl font-semibold">Compare Two Columns (Duplicates / Matches / Missing)</h2>
        <p className="text-white/80 text-muted max-w-3xl">
          Need to compare values across two columns instead of extracting from one? Use the{' '}
          <Link href="/compare-two-columns-in-excel" className="underline hover:no-underline">Compare Two Columns in Excel</Link>{' '}
          page to mark rows as <em>duplicates</em>, <em>matches</em>, or <em>missing items</em> — all processed entirely in your browser.
        </p>
        <div>
          <div className="text-sm text-white/70">CSV input</div>
          <pre className="mt-1 rounded border border-white/10 bg-white/5 p-3 overflow-auto text-sm"><code>{`order_id,sku_entered,sku_master
1001,SKU-001,SKU-001
1002,SKU-002,SKU-002
1003,SKU-003,SKU-004
1004,SKU-004,SKU-004
1005,SKU-005,
1006,SKU-006,SKU-006
1007,SKU-007,SKU-008`}</code></pre>
        </div>
        <ul className="text-white/80 text-sm space-y-1">
          <li><strong>Compare:</strong> sku_entered → sku_master</li>
          <li><strong>duplicates:</strong> True if the value in <code className="px-1 rounded bg-white/10">sku_entered</code> exists anywhere in <code className="px-1 rounded bg-white/10">sku_master</code> (trimmed; blanks ignored)</li>
          <li><strong>matches:</strong> True if <code className="px-1 rounded bg-white/10">sku_entered</code> equals <code className="px-1 rounded bg-white/10">sku_master</code> in the same row</li>
          <li><strong>missing items:</strong> True if the value in <code className="px-1 rounded bg-white/10">sku_entered</code> does not appear in <code className="px-1 rounded bg-white/10">sku_master</code></li>
        </ul>
        <p className="text-white/70 text-sm">
          The download preserves original columns and order, and adds one new column named based on the mode, e.g.,
          <code className="mx-1 px-1 rounded bg-white/10">duplicates_sku_entered_sku_master</code>.
        </p>
      </section>

      {/* 6) Conclusion */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Conclusion</h2>
        <p className="text-white/80 max-w-3xl">
          The same pattern works for many tasks: choose the Source column, describe the Target, preview a few rows,
          then process and download. Try it now on the{' '}
          <Link href="/extract-text-from-cell-excel" className="underline hover:no-underline">Extract Text from Cell</Link>{' '}
          page.
        </p>
      </section>
    </div>
  )
}
