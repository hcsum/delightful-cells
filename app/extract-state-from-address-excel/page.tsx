import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract State from Address in Excel (CSV Upload Tool)',
  description: 'Upload a CSV file and automatically extract US states from address columns using AI.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract State from Address</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the US state from an address column in your Excel file. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient initialTarget="US state as a two-letter abbreviation" initialSource="address" />
    </div>
  )
}
