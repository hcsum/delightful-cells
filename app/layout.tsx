import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import HeaderAuth from '@/components/HeaderAuth'

// Use default runtime; OpenNext will generate the Worker wrapper

export const metadata: Metadata = {
  title: {
    default: 'Extract Data from Excel & CSV Columns with AI',
    template: '%s | Extract from Excel & CSV',
  },
  description:
    'Extract structured data from Excel or CSV columns using AI. Define what to extract, preview results on the first 10 rows, then process and download up to 1,000 rows instantly.',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-white/10">
          <div className="container flex items-center justify-between">
            <Link href="/" className="font-semibold text-muted">Excel CSV AI Extractor</Link>
            <div className="flex items-center gap-4 md:gap-8 lg:gap-10 text-sm text-white/70 text-muted">
              <Link href="/extract-text-from-cell-excel" className="hidden md:inline hover:underline">Extract Text from Cell</Link>
              <Link href="/tutorial" className="hover:underline">Tutorial</Link>
              <ThemeToggle />
              <HeaderAuth />
            </div>
          </div>
        </header>
        <main className="container pb-24">{children}</main>
        <footer className="container text-xs text-white/60 py-8 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-end gap-4">
            <Link href="/tutorial" className="underline hover:no-underline">Tutorial</Link>
            <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link>
          </div>
        </footer>
      </body>
    </html>
  )
}
