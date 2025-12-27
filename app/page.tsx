import Link from 'next/link'
import type { Route } from 'next'
import { USE_CASES } from '@/lib/routes'
import Image from 'next/image'
import type { SVGProps } from 'react'

export const metadata = {
  title: 'Extract Text from Excel Cell or Column',
  description:
    'Extract specific text from a single Excel or CSV column using AI. Define what to extract, preview the first 3 rows, then download structured results. Ideal for pulling states, cities, names, numbers, or summarizing and classifying text from messy cells.',
  openGraph: {
    title: 'Extract Text from Excel Cell or Column',
    description:
      'Extract, classify, or summarize text from a single Excel or CSV column using AI. Preview results before downloading.',
    type: 'website',
    images: [
      {
        url: '/hero-image.png',
        width: 1200,
        height: 900,
        alt: 'AI extracting structured text from a single Excel or CSV column',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Extract Text from Excel Cell or Column',
    description:
      'Extract, classify, or summarize text from a single Excel or CSV column using AI.',
    images: ['/hero-image.png'],
  },
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
}

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-lg border border-white/10 bg-white/5 md:bg-transparent">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center p-5 md:p-8">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              Extract Text from Excel Cells
            </h1>

            <p className="text-white/80 max-w-xl">
              Use AI to extract, classify, or summarize specific information from
              a single column in your Excel or CSV file. Define what you want to
              extract, preview the first 3 rows, then download clean, structured
              results in seconds.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/extract-text-from-cell-excel"
                className="inline-flex items-center gap-2 px-4 py-2 rounded font-medium bg-white text-black hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-black/10 border border-transparent"
              >
                <span>Open Tool</span>
                <ArrowIcon className="h-4 w-4" />
              </Link>
            </div>

            {/* Value props */}
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                Extract from one selected column
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                Preview before full run
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                Works with CSV and Excel (XLSX)
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                States, cities, numbers, emails, and more
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                Classify text by meaning or category
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4" />
                Summarize messy cells into short results
              </li>
            </ul>
          </div>

          {/* Hero image */}
          <div className="order-first md:order-last">
            <div className="relative rounded-lg border border-white/10 overflow-hidden bg-white/5">
              <Image
                src="/hero-image.png"
                alt="AI extracting structured text from a single Excel or CSV column"
                width={1200}
                height={900}
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="space-y-3">
        <h2 className="text-xl font-semibold">
          Popular Excel Text Extraction Use Cases
        </h2>

        <p className="text-white/70 max-w-2xl">
          In addition to extracting specific values, you can also classify text
          into categories or summarize long, unstructured cells into concise,
          meaningful outputs — all from a single Excel column.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {USE_CASES.map((c) => (
            <Card key={c.href} href={c.href} title={c.title} />
          ))}
        </div>
      </section>
    </div>
  )
}

function Card({
  href,
  title,
}: {
  href: Route
  title: string
}) {
  return (
    <Link
      href={href}
      className="group block border border-white/10 rounded p-4 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <ArrowIcon className="h-4 w-4 text-white/60 group-hover:text-white/80" />
      </div>
    </Link>
  )
}

/* Icons */

function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  )
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
