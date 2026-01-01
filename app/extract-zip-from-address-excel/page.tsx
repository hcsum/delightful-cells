import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract ZIP / Postal Code from Address (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract ZIP or postal codes from address columns.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract ZIP / Postal Code from Address</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract ZIP or postal codes from an address column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient initialTarget="ZIP or postal code" initialSource="address" />
    </div>
  )
}
