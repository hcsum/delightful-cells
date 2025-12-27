import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
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
      <p className="text-white/80 max-w-2xl text-muted">Extract city names from an address column in your Excel file. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      <div className="flex items-center gap-3">
        <SignInButton />
        <QuotaBanner />
      </div>
      <CustomToolClient initialTarget="city name" initialSource="address" />
    </div>
  )
}
