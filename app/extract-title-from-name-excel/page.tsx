import CustomToolClient from '@/components/CustomToolClient'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Title from Name (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract titles (Mr, Ms, Dr, etc.) from a name column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Title from Name</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract honorifics or titles from a name column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per day.</p>
      </div>
      <CustomToolClient initialTarget="honorific or title (e.g., Mr, Ms, Dr, Prof)" initialSource="name" />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>Select the <strong>Source column</strong> with full names (e.g., “name”).</li>
            <li>Set <strong>Target</strong> to “title”.</li>
            <li><strong>Upload CSV</strong> and preview to validate titles (Mr, Ms, Mrs, Dr, Prof, etc.).</li>
            <li><strong>Process full file</strong> to download a file with a new title column.</li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
      <section className="space-y-12">
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example — Extract title from name</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> title (Mr, Ms, Mrs, Dr, Prof, etc.)</li>
            <li><strong>Source:</strong> name</li>
          </ul>
          <div className="space-y-2">
            <div>Expected output:</div>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">name</th>
                    <th className="border-b border-white/10 py-1">title</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">Mr John Smith</td>
                    <td className="align-top py-1">Mr</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Dr Ada Lovelace</td>
                    <td className="align-top py-1">Dr</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Ms Grace Hopper</td>
                    <td className="align-top py-1">Ms</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Prof Alan Turing</td>
                    <td className="align-top py-1">Prof</td>
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
