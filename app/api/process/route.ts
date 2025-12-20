import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // Placeholder endpoint for MVP frontend only.
  // Backend processing will be handled by a Cloudflare Worker in production.
  try {
    const body = await req.json().catch(() => ({}));
    const { rows, promptType, promptTemplate } = body || {};
    return NextResponse.json(
      {
        message: 'Not implemented in Next.js. This route will proxy to Cloudflare Workers in production.',
        echo: {
          rows: Array.isArray(rows) ? rows.slice(0, 10) : [],
          promptType: promptType ?? null,
          promptTemplate: promptTemplate ?? null,
        },
        results: [],
      },
      { status: 501 }
    );
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
// Use default Node.js runtime for OpenNext Cloudflare compatibility
