import CustomToolClient from '@/components/CustomToolClient'
import SignInButton from '@/components/SignInButton'
import { DAILY_ROWS_LIMIT } from '@/lib/limits'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract First Name from Full Name (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract first names from a full name column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract First Name from Full Name</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract first names from a full name column in your Excel file. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <p className="text-white/60 max-w-2xl text-sm">Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows per account.</p>
      <SignInButton />
      <CustomToolClient initialTarget="first name" initialSource="full name" />
    </div>
  )
}
