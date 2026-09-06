import CustomToolClient from '@/components/CustomToolClient'
import RowsLimitNote from '@/components/RowsLimitNote'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract City from Address in Excel (CSV Upload Tool)',
  description: 'Upload a CSV file and automatically extract city names from address columns using AI.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract City from Address</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract city names from an address column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <RowsLimitNote />
      <div className="flex items-center gap-3">
        <QuotaBanner />
      </div>
      <CustomToolClient initialTarget="city name" initialSource="address" />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>Pick the <strong>Source column</strong> that contains full mailing addresses.</li>
            <li>Set the <strong>Target</strong> to “city name”.</li>
            <li><strong>Upload CSV</strong> and preview a few rows to verify the city output.</li>
            <li><strong>Process full file</strong> to download your results with a new city column.</li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
      <section className="space-y-12">
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example — Extract city from address</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> city name</li>
            <li><strong>Source:</strong> address</li>
          </ul>
          <div className="space-y-2">
            <div>Expected output:</div>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">address</th>
                    <th className="border-b border-white/10 py-1">city</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">1600 Amphitheatre Parkway, Mountain View, CA 94043</td>
                    <td className="align-top py-1">Mountain View</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">One Apple Park Way, Cupertino, CA 95014</td>
                    <td className="align-top py-1">Cupertino</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">350 Fifth Avenue, New York, NY 10118</td>
                    <td className="align-top py-1">New York</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">1 Microsoft Way, Redmond, WA 98052</td>
                    <td className="align-top py-1">Redmond</td>
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
