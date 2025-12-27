import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
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
      <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      <SignInButton />
      <CustomToolClient />
    </div>
  )
}

