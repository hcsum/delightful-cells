import { NextResponse } from 'next/server'
import { USE_CASES, STATIC_ROUTES } from '@/lib/routes'

type RouteEntry = { path: string; priority: string; changefreq: string }

function prioritize(path: string): RouteEntry {
  const p = path === '/' ? '1.0' : path.startsWith('/excel-') ? '0.9' : '0.8'
  const cf = path === '/' ? 'weekly' : 'monthly'
  return { path, priority: p, changefreq: cf }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://extractfromexcel.com')
  // Registry-driven list
  const paths: string[] = Array.from(new Set<string>([
    ...STATIC_ROUTES,
    ...USE_CASES.map((c) => c.href as string),
  ]))
  // Always include known canonical pages if present
  const canonical = [
    '/excel-extract-number-from-string',
    '/excel-extract-year-from-date',
  ]
  for (const c of canonical) if (!paths.includes(c)) paths.push(c)

  const routes: RouteEntry[] = paths
    .filter((p) => typeof p === 'string' && p.startsWith('/'))
    .map(prioritize)

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
