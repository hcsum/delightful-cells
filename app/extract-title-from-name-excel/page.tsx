import PredefinedToolClient from '@/components/PredefinedToolClient'
import { PROMPTS } from '@/lib/extractors'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Title from Name (Excel CSV Upload Tool)',
  description: 'Upload a CSV and extract titles (Mr, Ms, Dr, etc.) from a name column.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Title from Name</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract honorifics or titles from a name column in your CSV. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <PredefinedToolClient kind="titleFromName" promptTemplate={PROMPTS.titleFromName} />
    </div>
  )
}

