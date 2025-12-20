import PredefinedToolClient from '@/components/PredefinedToolClient'
import { PROMPTS } from '@/lib/extractors'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Username from Email (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract the username (local-part) from an email column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Username from Email</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the username (local-part before @) of email addresses from a column in your CSV. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <PredefinedToolClient kind="usernameFromEmail" promptTemplate={PROMPTS.usernameFromEmail} />
    </div>
  )
}

