import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth/server';

export async function GET(request: Request) {
  const auth = getAuth();
  const handler = toNextJsHandler(auth.handler);
  return handler.GET(request);
}

export async function POST(request: Request) {
  const auth = getAuth();
  const handler = toNextJsHandler(auth.handler);
  return handler.POST(request);
}
