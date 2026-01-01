import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Text from Cell (Excel CSV Extraction Tool)',
  description: 'Describe what to extract and select the source column. Preview a few sample rows to check the result, or process the full file right away.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Text from Cell</h1>
      <p className="text-white/80 max-w-2xl text-muted">Describe what to extract and select the source column. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient />
    </div>
  )
}
