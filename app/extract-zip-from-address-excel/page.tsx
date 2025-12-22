import PredefinedToolClient from '@/components/PredefinedToolClient'
import { PROMPTS } from '@/lib/extractors'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract ZIP / Postal Code from Address (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract ZIP or postal codes from address columns.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract ZIP / Postal Code from Address</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract ZIP or postal codes from an address column in your Excel file. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <PredefinedToolClient kind="zip" promptTemplate={PROMPTS.zip} />
    </div>
  )
}

