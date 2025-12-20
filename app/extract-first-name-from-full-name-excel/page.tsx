import PredefinedToolClient from '@/components/PredefinedToolClient'
import { PROMPTS } from '@/lib/extractors'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract First Name from Full Name (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract first names from a full name column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract First Name from Full Name</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract first names from a full name column in your CSV. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <PredefinedToolClient kind="firstName" promptTemplate={PROMPTS.firstName} />
    </div>
  )
}

