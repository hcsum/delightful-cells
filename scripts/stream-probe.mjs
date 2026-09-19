const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const model = '@cf/zai-org/glm-5.3-flash';
if (!accountId || !token) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
  process.exit(1);
}

const startedAt = Date.now();
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    max_tokens: 32,
    temperature: 0,
    reasoning_effort: 'low',
    stream: true,
  }),
});
console.log(JSON.stringify({ status: response.status, contentType: response.headers.get('content-type') }));
if (!response.ok || !response.body) process.exit(1);

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let firstChunkAt = 0;
while (true) {
  const { value, done } = await reader.read();
  if (!firstChunkAt && value?.length) firstChunkAt = Date.now();
  buffer += decoder.decode(value, { stream: !done });
  const frames = buffer.split(/\r?\n\r?\n/);
  buffer = frames.pop() ?? '';
  for (const frame of frames) {
    const raw = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
    if (!raw) continue;
    if (raw === '[DONE]') {
      console.log(JSON.stringify({ done: true }));
      continue;
    }
    try {
      const chunk = JSON.parse(raw);
      const delta = chunk?.choices?.[0]?.delta ?? {};
      console.log(JSON.stringify({
        keys: Object.keys(chunk),
        deltaKeys: Object.keys(delta),
        contentLength: typeof delta.content === 'string' ? delta.content.length : 0,
        reasoningLength: typeof delta.reasoning_content === 'string' ? delta.reasoning_content.length : 0,
        usage: chunk.usage ?? null,
      }));
    } catch {
      console.log(JSON.stringify({ malformedFrameLength: raw.length }));
    }
  }
  if (done) break;
}
console.log(JSON.stringify({ firstChunkMs: firstChunkAt ? firstChunkAt - startedAt : null, totalMs: Date.now() - startedAt }));
