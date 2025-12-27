import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Excel: Extract Year from Date (CSV Tool)',
  description:
    'Extract the year from a date column in your Excel or CSV file. Ideal for grouping, filtering, or summarizing by year. Preview results, then process the full file.',
  alternates: { canonical: '/excel-extract-year-from-date' },
  openGraph: {
    title: 'Excel: Extract Year from Date',
    description: 'Pull 4-digit years from a date column in Excel/CSV — with a preview before full processing.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Excel: Extract Year from Date',
    description: 'Extract year values from a date column in Excel/CSV quickly and reliably.',
  },
  robots: { index: true, follow: true },
}

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Excel: Extract Year from Date</h1>
      <p className="text-white/80 max-w-2xl text-muted">
        Select your date column and pull just the 4-digit year. Great for analyzing by year without changing your original data. Paste a few rows to preview, then upload and process the full file.
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient initialTarget="year" initialSource="date" />
    </div>
  )
}
