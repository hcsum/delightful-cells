import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Username from Email (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract the username (local-part) from an email column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Username from Email</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the username (local-part before @) of email addresses from a column in your Excel file. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <SignInButton />
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      </div>
      <CustomToolClient initialTarget="username (local-part before @)" initialSource="email address" />
    </div>
  )
}
