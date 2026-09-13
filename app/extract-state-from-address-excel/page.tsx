import CustomToolClient from '@/components/CustomToolClient'
import RowsLimitNote from '@/components/RowsLimitNote'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract State from Address in Excel (Excel & CSV Tool)',
  description: 'Upload an Excel file or CSV and automatically extract US states from address columns using AI.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract State from Address</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the US state from an address column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
      <RowsLimitNote />
      </div>
      <CustomToolClient initialTarget="US state as a two-letter abbreviation" initialSource="address" />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li><strong>Upload your Excel file</strong> — .xlsx, .xls, or .csv.</li>
            <li>Pick the <strong>Source column</strong> with full postal addresses.</li>
            <li>Set <strong>Target</strong> to “US state as a two-letter abbreviation”.</li>
            <li><strong>Preview</strong> to verify state extraction.</li>
            <li><strong>Process full file</strong> and download with a new state column.</li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
      <section className="space-y-12">
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example — Extract US state from address</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> US state abbreviation (e.g., CA, NY)</li>
            <li><strong>Source:</strong> address</li>
          </ul>
          <div className="space-y-2">
            <div>Expected output:</div>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">address</th>
                    <th className="border-b border-white/10 py-1">state</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">1600 Amphitheatre Parkway, Mountain View, CA 94043</td>
                    <td className="align-top py-1">CA</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">350 Fifth Avenue, New York, NY 10118</td>
                    <td className="align-top py-1">NY</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">1 Microsoft Way, Redmond, WA 98052</td>
                    <td className="align-top py-1">WA</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">1 Infinite Loop, Cupertino, CA 95014</td>
                    <td className="align-top py-1">CA</td>
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
