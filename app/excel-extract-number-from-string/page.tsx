import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Excel: Extract Number from String (CSV Tool)',
  description:
    'Extract numbers from text strings in an Excel or CSV column. Perfect for pulling prices, IDs, SKUs, and other digits from messy cells. Preview results, then process the full file.',
  alternates: { canonical: '/excel-extract-number-from-string' },
  openGraph: {
    title: 'Excel: Extract Number from String',
    description:
      'Pull numeric values from a text column in Excel/CSV — prices, IDs, SKUs, and more — with a preview before full processing.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Excel: Extract Number from String',
    description:
      'Extract digits from a text column in Excel/CSV — prices, IDs, SKUs, and more — fast and reliably.',
  },
  robots: { index: true, follow: true },
}

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Excel: Extract Number from String</h1>
      <p className="text-white/80 max-w-2xl text-muted">
        Pull numeric values from a text column in your Excel or CSV file — great for prices, IDs, SKUs, postal codes, or any digits embedded in strings. Paste a few rows to preview, then upload and process the full file.
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>
              Select the <strong>Source column</strong> that holds mixed text (e.g., descriptions or notes).
            </li>
            <li>
              Keep the <strong>Target</strong> as “all numeric values” to pull integers and decimals.
            </li>
            <li>
              <strong>Upload CSV</strong> and preview a few rows; adjust if needed.
            </li>
            <li>
              <strong>Process full file</strong> and download a copy with a new numbers column.
            </li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
      <section className="space-y-12">
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example — Extract numbers from mixed text</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> all numeric values (including decimals)</li>
            <li><strong>Source:</strong> text</li>
          </ul>
          <div className="space-y-2">
            <div>Expected output:</div>
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
                    <td className="align-top py-1"></td>
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
    </div>
  )
}
