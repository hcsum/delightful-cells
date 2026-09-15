// Sink for the dev trace (lib/trace.ts): appends one JSON event per line to
// .dev-trace/<day>.jsonl so a turn can be read after it has scrolled out of
// the console. Local development only — in production the route is a 404 and
// nothing is written anywhere.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404 });

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return notFound();
  const line = await request.text();
  if (!line || line.length > 2_000_000) return new Response(null, { status: 204 });
  try {
    // Imported lazily so the module never lands in a bundle that has no fs.
    const { mkdir, appendFile } = await import('node:fs/promises');
    const dir = `${process.cwd()}/.dev-trace`;
    await mkdir(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    await appendFile(`${dir}/${day}.jsonl`, `${line.replace(/\n/g, ' ')}\n`);
  } catch {
    // A trace that cannot be written is not worth failing a request over.
  }
  return new Response(null, { status: 204 });
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return notFound();
  return Response.json({ status: 'ok', note: 'dev trace sink', dir: '.dev-trace' });
}
