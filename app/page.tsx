import Link from 'next/link'

export const metadata = {
  title: 'Extract Text from Cell (Excel)',
  description:
    'Use AI to extract text from a selected column in your Excel file. Preview sample rows before processing the full file, and get a downloadable result instantly. Extract specific data from one column, pull out states, cities, numbers, or other text you need.',
};

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Extract Text from Cell</h1>
        <p className="text-white/80 text-muted">Use AI to extract text from a selected column in your Excel file. Preview sample rows before processing the full file, and get a downloadable result instantly. Extract specific data from one column, pull out states, cities, numbers, or other text you need.</p>
        <Link href="/extract-text-from-cell-excel" className="inline-block px-4 py-2 rounded bg-white/10 hover:bg-white/20">Open Tool</Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Or You Can Choose a Use Case</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card href="/extract-state-from-address-excel" title="Extract State from Address" />
          <Card href="/extract-city-from-address-excel" title="Extract City from Address" />
          <Card href="/extract-zip-from-address-excel" title="Extract ZIP / Postal Code from Address" />
          <Card href="/extract-first-name-from-full-name-excel" title="Extract First Name from Full Name" />
          <Card href="/extract-last-name-from-full-name-excel" title="Extract Last Name from Full Name" />
          <Card href="/extract-title-from-name-excel" title="Extract Title from Name" />
          <Card href="/extract-domain-from-email-excel" title="Extract Domain from Email" />
          <Card href="/extract-username-from-email-excel" title="Extract Username from Email" />
        </div>
      </section>
    </div>
  )
}

function Card({ href, title }: { href: 
  '/extract-state-from-address-excel' |
  '/extract-city-from-address-excel' |
  '/extract-zip-from-address-excel' |
  '/extract-first-name-from-full-name-excel' |
  '/extract-last-name-from-full-name-excel' |
  '/extract-title-from-name-excel' |
  '/extract-domain-from-email-excel' |
  '/extract-username-from-email-excel';
  title: string }) {
  return (
    <Link href={href} className="block border border-white/10 rounded p-4 hover:bg-white/5 card-link">
      <div className="font-medium">{title}</div>
    </Link>
  )
}
