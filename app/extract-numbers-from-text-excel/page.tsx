import CustomToolClient from '@/components/CustomToolClient'
import RowsLimitNote from '@/components/RowsLimitNote'
import QuotaBanner from '@/components/QuotaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract Numbers from Text in Excel (CSV Upload Tool)',
  description: 'Upload a CSV file and automatically extract numbers from text columns using AI.',
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Extract Numbers from Text</h1>
      <p className="text-white/80 max-w-2xl text-muted">Extract numbers from a text column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
      <RowsLimitNote />
      </div>
      <CustomToolClient initialTarget="all numbers" initialSource="text" />
    </div>
  )
}
