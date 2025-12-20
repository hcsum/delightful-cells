import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

// Use default runtime; OpenNext will generate the Worker wrapper

export const metadata: Metadata = {
  title: {
    default: 'Extract Data From CSV Columns (Excel)',
    template: '%s',
  },
  description:
    'Upload a CSV or paste rows and extract structured data from a specific column using predefined prompts. Preview results on the first 10 rows, then download up to 1,000 rows.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-white/10">
          <div className="container flex items-center justify-between">
            <Link href="/" className="font-semibold text-muted">Excel CSV AI Extractor</Link>
            <div className="flex items-center gap-4 text-sm text-white/70 text-muted">
              <Link href="/extract-text-from-cell-excel" className="hover:underline">Extract Text from Cell</Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="container pb-24">{children}</main>
        <footer className="container text-xs text-white/60 py-8 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-end gap-4">
            <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link>
          </div>
        </footer>
      </body>
    </html>
  )
}
