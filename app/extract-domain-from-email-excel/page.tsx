import PredefinedToolClient from '@/components/PredefinedToolClient'
import { PROMPTS } from '@/lib/extractors'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Domain from Email (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract the domain from an email column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Domain from Email</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the domain part of email addresses from a column in your Excel file. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <PredefinedToolClient kind="domainFromEmail" promptTemplate={PROMPTS.domainFromEmail} />
    </div>
  )
}

