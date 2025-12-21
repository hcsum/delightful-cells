import { NextResponse } from 'next/server'

export async function GET() {
  // Get base URL from environment variable or use a default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://extractfromexcel.com')

  // Define all routes with their priorities and change frequencies
  const routes = [
    {
      path: '/',
      priority: '1.0',
      changefreq: 'weekly',
    },
    {
      path: '/extract-text-from-cell-excel',
      priority: '0.9',
      changefreq: 'monthly',
    },
    {
      path: '/extract-state-from-address-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-city-from-address-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-zip-from-address-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-first-name-from-full-name-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-last-name-from-full-name-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-title-from-name-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-domain-from-email-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-username-from-email-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/extract-numbers-from-text-excel',
      priority: '0.8',
      changefreq: 'monthly',
    },
    {
      path: '/terms',
      priority: '0.5',
      changefreq: 'yearly',
    },
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new NextResponse(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate',
    },
  })
}

