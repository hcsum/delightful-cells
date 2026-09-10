import type { Route } from 'next'
import type { AppLocale } from '@/lib/locale-routing'

// Central registry of site routes used by Home and Sitemap

export type UseCase = { href: Route; title: string; titleZh: string }

// Curated list shown on the Home page and included in the sitemap
export const USE_CASES: UseCase[] = [
  { href: '/extract-state-from-address-excel', title: 'Excel: Extract State from Address', titleZh: 'Excel：从地址提取州' },
  { href: '/extract-city-from-address-excel', title: 'Excel: Extract City from Address', titleZh: 'Excel：从地址提取城市' },
  { href: '/extract-zip-from-address-excel', title: 'Excel: Extract ZIP / Postal Code from Address', titleZh: 'Excel：从地址提取邮编' },
  { href: '/extract-first-name-from-full-name-excel', title: 'Excel: Extract First Name from Full Name', titleZh: 'Excel：从姓名提取名' },
  { href: '/extract-last-name-from-full-name-excel', title: 'Excel: Extract Last Name from Full Name', titleZh: 'Excel：从姓名提取姓' },
  { href: '/extract-title-from-name-excel', title: 'Excel: Extract Title from Name (Mr, Ms, Dr)', titleZh: 'Excel：从姓名提取称谓' },
  { href: '/extract-domain-from-email-excel', title: 'Excel: Extract Domain from Email Address', titleZh: 'Excel：从邮箱提取域名' },
  { href: '/extract-username-from-email-excel', title: 'Excel: Extract Username from Email Address', titleZh: 'Excel：从邮箱提取用户名' },
  { href: '/excel-extract-number-from-string', title: 'Excel: Extract Number from String', titleZh: 'Excel：从字符串提取数字' },
  { href: '/excel-extract-year-from-date', title: 'Excel: Extract Year from Date', titleZh: 'Excel：从日期提取年份' },
]

export function useCaseTitle(useCase: UseCase, locale: AppLocale) {
  return locale === 'zh' ? useCase.titleZh : useCase.title
}

// Additional static pages to include in the sitemap
export const STATIC_ROUTES: Route[] = [
  '/',
  '/extract-text-from-cell-excel',
  '/extract-numbers-from-text-excel',
  '/compare-two-columns-in-excel',
  '/find-duplicates-in-excel',
  '/pricing',
  '/terms',
]
