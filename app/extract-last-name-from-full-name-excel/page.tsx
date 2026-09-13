import CustomToolClient from '@/components/CustomToolClient'
import RowsLimitNote from '@/components/RowsLimitNote'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Last Name from Full Name (Excel & CSV Tool)',
  description: 'Upload an Excel file (.xlsx) or CSV and extract last names from a full name column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Last Name from Full Name</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract last names from a full name column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
      <RowsLimitNote />
      </div>
      <CustomToolClient initialTarget="last name (surname)" initialSource="full name" />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li><strong>Upload your Excel file</strong> — .xlsx, .xls, or .csv.</li>
            <li>Pick the <strong>Source column</strong> that contains full names.</li>
            <li>Set <strong>Target</strong> to “last name”.</li>
            <li><strong>Preview</strong> a few rows (supports middle names and multi-word surnames).</li>
            <li><strong>Process full file</strong> to download a copy with a new last-name column.</li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
      <section className="space-y-12">
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example — Extract last name from full name</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> last name</li>
            <li><strong>Source:</strong> full name</li>
          </ul>
          <div className="space-y-2">
            <div>Expected output:</div>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">full name</th>
                    <th className="border-b border-white/10 py-1">last name</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">Ada Lovelace</td>
                    <td className="align-top py-1">Lovelace</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Grace Hopper</td>
                    <td className="align-top py-1">Hopper</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">Alan Mathison Turing</td>
                    <td className="align-top py-1">Turing</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">John von Neumann</td>
                    <td className="align-top py-1">Neumann</td>
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
