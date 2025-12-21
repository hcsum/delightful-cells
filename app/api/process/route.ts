export async function POST() {}

export async function GET() {
  const body = JSON.stringify({ status: 'ok', ts: new Date().toISOString(), note: 'api-process' });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
