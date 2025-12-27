import { NextResponse } from 'next/server'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

type RouteEntry = { path: string; priority: string; changefreq: string }

const EXCLUDE_DIRS = new Set(['api', 'sitemap.xml', 'robots.txt'])

function isDynamic(seg: string) {
  return seg.includes('[')
}

function isGroup(seg: string) {
  return seg.startsWith('(') && seg.endsWith(')')
}

async function dirHasPage(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir)
    return entries.some((f) => f === 'page.tsx' || f === 'page.js' || f === 'page.mjs' || f === 'page.jsx')
  } catch {
    return false
  }
}

async function collectAppRoutes(root: string, rel = ''): Promise<string[]> {
  let out: string[] = []
  let entries: string[] = []
  try {
    entries = await readdir(join(root, rel), { withFileTypes: false }) as unknown as string[]
  } catch {
    return out
  }
  // We need to list directories under app/rel; emulate minimal recursion using another call to readdir withFileTypes when available.
  try {
    const dirents: any[] = await (readdir as any)(join(root, rel), { withFileTypes: true })
    for (const d of dirents) {
      if (!d?.isDirectory?.()) continue
      const name: string = String(d.name)
      if (EXCLUDE_DIRS.has(name)) continue
      if (isDynamic(name)) continue
      const nextRel = rel ? `${rel}/${name}` : name
      const pageDir = join(root, nextRel)
      const hasPage = await dirHasPage(pageDir)
      // Build URL segment (ignore group segments in URL path)
      const seg = isGroup(name) ? '' : `/${name}`
      if (hasPage) {
        const url = (rel === '' && name === 'page') ? '/' : (seg || '/')
        // However, Next app root page lives in app/page.tsx; we handle it separately below.
        if (url !== '/') out.push((rel ? `/${rel}` : '') + seg)
      }
      const sub = await collectAppRoutes(root, nextRel)
      out.push(...sub)
    }
  } catch {
    // Fallback to files list (non-dirent environments)
  }
  // Root page
  if (!rel) {
    const hasRoot = await dirHasPage(root)
    if (hasRoot) out.unshift('/')
  }
  return Array.from(new Set(out.filter(Boolean)))
}

function prioritize(path: string): RouteEntry {
  const p = path === '/' ? '1.0' : path.startsWith('/excel-') ? '0.9' : '0.8'
  const cf = path === '/' ? 'weekly' : 'monthly'
  return { path, priority: p, changefreq: cf }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://extractfromexcel.com')
  let paths: string[] = []
  try {
    paths = await collectAppRoutes(join(process.cwd(), 'app'))
  } catch {
    // Last-resort fallback: minimal hand list
    paths = ['/', '/tutorial', '/extract-text-from-cell-excel']
  }
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
