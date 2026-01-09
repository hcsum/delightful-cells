import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tutorials: CSV/Excel Tools',
  description:
    'Guides for Find Duplicates in a Single Column and Compare Two Columns — processed entirely in your browser.',
  alternates: { canonical: '/tutorial' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Tutorials: CSV/Excel Tools',
    description:
      'Learn to flag duplicates in one column or compare two columns for duplicates, matches, and missing items.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Tutorials: CSV/Excel Tools',
    description: 'Step-by-step guides for duplicates and column comparison features.',
  },
}

export default function TutorialPage() {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Tutorials: CSV/Excel Tools</h1>
        <p className="text-white/80 text-muted max-w-3xl">
          Learn how to use our in-browser tools to flag duplicates within a single column and to compare values across
          two columns. For extracting text from one column, see the dedicated{' '}
          <Link href="/extract-text-from-cell-excel" className="underline hover:no-underline">Extract Text from Cell</Link>{' '}
          page.
        </p>
      </section>

      {/* Outline / On this page */}
      <nav aria-label="Tutorial outline" className="space-y-2">
        <h2 className="text-xl font-semibold">On This Page</h2>
        <ul className="list-disc pl-6 text-white/80">
          <li>
            <a href="#find-duplicates" className="underline hover:no-underline">Find Duplicates in a Single Column</a>
          </li>
          <li>
            <a href="#compare-columns" className="underline hover:no-underline">Compare Two Columns</a>
          </li>
        </ul>
      </nav>

      {/* Removed extract-text sections; now focused on duplicates and compare */}

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

      {/* Conclusion */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Conclusion</h2>
        <p className="text-white/80 max-w-3xl">
          Use the dedicated pages for each task: <Link href="/find-duplicates-in-excel" className="underline hover:no-underline">Find Duplicates in Excel</Link>,{' '}
          <Link href="/compare-two-columns-in-excel" className="underline hover:no-underline">Compare Two Columns in Excel</Link>, and{' '}
          <Link href="/extract-text-from-cell-excel" className="underline hover:no-underline">Extract Text from Cell</Link>.
        </p>
      </section>
    </div>
  )
}
