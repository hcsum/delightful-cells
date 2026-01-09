import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract First Name from Full Name (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract first names from a full name column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract First Name from Full Name</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract first names from a full name column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient initialTarget="first name" initialSource="full name" />

      {/* How to Use + Examples */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>Select the <strong>Source column</strong> that contains full names (e.g., "full name").</li>
            <li>Set <strong>Target</strong> to “first name”.</li>
            <li><strong>Upload CSV</strong> and preview a few rows; supports middle names and multi-word surnames.</li>
            <li><strong>Process full file</strong> to download a copy with a new first-name column.</li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
      </div>
    </div>
  )
}
