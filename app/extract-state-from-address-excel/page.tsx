import PredefinedToolClient from '@/components/PredefinedToolClient'
import { PROMPTS } from '@/lib/extractors'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract State from Address in Excel (CSV Upload Tool)',
  description: 'Upload a CSV file and automatically extract US states from address columns using AI.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract State from Address</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract the US state from an address column in your CSV. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <PredefinedToolClient kind="state" promptTemplate={PROMPTS.state} />
    </div>
  )
}
