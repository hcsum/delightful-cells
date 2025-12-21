export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-request-id, x-action, x-app',
      'Access-Control-Max-Age': '86400',
    },
  });
}

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

export async function POST(request: Request) {
  // Get worker URL from environment variable
  const workerUrl = process.env.LLM_WORKER_URL;
  
  if (!workerUrl) {
    return new Response(
      JSON.stringify({ 
        error: 'LLM_WORKER_URL not configured',
        message: 'Server configuration error: LLM worker URL is not set' 
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      }
    );
  }

  try {
    // Get request headers to forward
    const requestId = request.headers.get('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const action = request.headers.get('x-action') || 'preview';
    const app = request.headers.get('x-app') || 'excel-extract-column-app';
    const origin = request.headers.get('Origin') || request.headers.get('origin') || '';

    // Get request body
    const body = await request.json();

    // Forward request to LLM worker
    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
        'x-action': action,
        'x-app': app,
        ...(origin ? { 'Origin': origin } : {}),
      },
      body: JSON.stringify(body),
    });

    // Get response body
    const responseBody = await workerResponse.text();
    
    // Forward response with appropriate headers
    const headers: Record<string, string> = {
      'content-type': workerResponse.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    };

    // Forward CORS headers if present
    const corsOrigin = workerResponse.headers.get('Access-Control-Allow-Origin');
    if (corsOrigin) {
      headers['Access-Control-Allow-Origin'] = corsOrigin;
    }

    // Forward rate limit headers if present
    const rateLimitHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'];
    rateLimitHeaders.forEach(headerName => {
      const value = workerResponse.headers.get(headerName);
      if (value) {
        headers[headerName] = value;
      }
    });

    return new Response(responseBody, {
      status: workerResponse.status,
      statusText: workerResponse.statusText,
      headers,
    });
  } catch (error) {
    console.error('[api/process] Error proxying to worker:', error);
    return new Response(
      JSON.stringify({ 
        error: 'proxy_error',
        message: error instanceof Error ? error.message : 'Failed to proxy request to LLM worker' 
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      }
    );
  }
}
