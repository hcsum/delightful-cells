export type StreamUsage = {
  inputTokens: number;
  outputTokens: number;
  neurons: number;
};

type AppEvent = {
  type: string;
  requestId: string;
  seq: number;
  at: number;
  data: unknown;
};

export function writeSseEvent(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  event: AppEvent,
): Promise<void> {
  return writer.write(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

export function extractStreamDelta(chunk: any): string {
  const raw =
    chunk?.choices?.[0]?.delta?.content ??
    chunk?.choices?.[0]?.message?.content ??
    chunk?.response ??
    chunk?.delta?.content ??
    '';
  return typeof raw === 'string' ? raw : '';
}

export function extractStreamUsage(chunk: any): StreamUsage | null {
  const usage = chunk?.usage ?? chunk?.result?.usage;
  if (!usage || typeof usage !== 'object') return null;
  const normalized = {
    inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens) || 0,
    outputTokens: Number(usage.completion_tokens ?? usage.output_tokens) || 0,
    neurons: Number(usage.neurons) || 0,
  };
  return normalized.inputTokens || normalized.outputTokens || normalized.neurons
    ? normalized
    : null;
}

export async function consumeWorkersAiStream(
  source: unknown,
  onChunk: (chunk: any) => void | Promise<void>,
): Promise<void> {
  const stream = source instanceof Response
    ? source.body
    : source instanceof ReadableStream
      ? source
      : null;
  if (!stream) throw new Error('Workers AI did not return a readable stream');

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const consumeFrame = async (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
      .trim();
    if (!data || data === '[DONE]') return;
    await onChunk(JSON.parse(data));
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) await consumeFrame(frame);
      if (done) break;
    }
    if (buffer.trim()) await consumeFrame(buffer);
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
