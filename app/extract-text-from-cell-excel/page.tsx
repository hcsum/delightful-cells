import CustomToolClient from '@/components/CustomToolClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Text from Cell (Excel CSV Extraction Tool)',
  description: 'Describe what to extract and select the source column. Preview a few sample rows to check the result, or skip preview and process the full file right away.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Text from Cell</h1>
      <p className="text-white/80 max-w-2xl text-muted">Describe what to extract and select the source column. Preview a few sample rows to check the result, or skip preview and process the full file right away.</p>
      <CustomToolClient />
    </div>
  )
}
