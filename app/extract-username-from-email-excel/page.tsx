import CustomToolClient from '@/components/CustomToolClient'
import RowsLimitNote from '@/components/RowsLimitNote'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Username from Email (Excel & CSV Tool)',
  description: 'Upload an Excel file (.xlsx) or CSV and extract the username (local-part) from an email column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Username from Email</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the username (local-part before @) of email addresses from a column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
      <RowsLimitNote />
      </div>
      <CustomToolClient initialTarget="username (local-part before @)" initialSource="email address" />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li><strong>Upload your Excel file</strong> — .xlsx, .xls, or .csv.</li>
            <li>Pick the <strong>Source column</strong> with email addresses.</li>
            <li>Set <strong>Target</strong> to “username (local-part before @)”.</li>
            <li><strong>Preview</strong>; plus-addressing remains in the username.</li>
            <li><strong>Process full file</strong> and download with a new username column.</li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
      <section className="space-y-12">
        <article className="space-y-3">
          <h3 className="text-lg font-medium">Example — Extract username from email</h3>
          <ul className="text-white/80 text-sm space-y-1">
            <li><strong>Target:</strong> username (local-part before @)</li>
            <li><strong>Source:</strong> email address</li>
          </ul>
          <div className="space-y-2">
            <div>Expected output:</div>
            <div className="overflow-auto">
              <table className="mt-1 w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-white/10 py-1 pr-4">email address</th>
                    <th className="border-b border-white/10 py-1">username</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="align-top pr-4 py-1">alice@example.com</td>
                    <td className="align-top py-1">alice</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">bob@company.co.uk</td>
                    <td className="align-top py-1">bob</td>
                  </tr>
                  <tr>
                    <td className="align-top pr-4 py-1">carol+sales@my-site.io</td>
                    <td className="align-top py-1">carol+sales</td>
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
