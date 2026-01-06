import type { Route } from 'next'

// Central registry of site routes used by Home and Sitemap

export type UseCase = { href: Route; title: string }

// Curated list shown on the Home page and included in the sitemap
export const USE_CASES: UseCase[] = [
  { href: '/extract-state-from-address-excel', title: 'Excel: Extract State from Address' },
  { href: '/extract-city-from-address-excel', title: 'Excel: Extract City from Address' },
  { href: '/extract-zip-from-address-excel', title: 'Excel: Extract ZIP / Postal Code from Address' },
  { href: '/extract-first-name-from-full-name-excel', title: 'Excel: Extract First Name from Full Name' },
  { href: '/extract-last-name-from-full-name-excel', title: 'Excel: Extract Last Name from Full Name' },
  { href: '/extract-title-from-name-excel', title: 'Excel: Extract Title from Name (Mr, Ms, Dr)' },
  { href: '/extract-domain-from-email-excel', title: 'Excel: Extract Domain from Email Address' },
  { href: '/extract-username-from-email-excel', title: 'Excel: Extract Username from Email Address' },
  { href: '/excel-extract-number-from-string', title: 'Excel: Extract Number from String' },
  { href: '/excel-extract-year-from-date', title: 'Excel: Extract Year from Date' },
]

// Additional static pages to include in the sitemap
export const STATIC_ROUTES: Route[] = [
  '/',
  '/tutorial',
  '/extract-text-from-cell-excel',
  '/extract-numbers-from-text-excel',
  '/compare-two-columns-in-excel',
  '/find-duplicates-in-excel',
  '/terms',
]
