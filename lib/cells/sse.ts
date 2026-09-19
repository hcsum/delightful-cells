export type SseEnvelope<T = unknown> = {
  type: string;
  requestId: string;
  seq: number;
  at: number;
  data: T;
};

/** Parse SSE without assuming network chunks line up with UTF-8 or frame boundaries. */
export async function readSse(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: SseEnvelope) => void | Promise<void>,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const consume = async (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error("Malformed SSE event data.");
    }
    if (!parsed || typeof parsed !== "object" || typeof (parsed as SseEnvelope).type !== "string") {
      throw new Error("Malformed SSE event envelope.");
    }
    await onEvent(parsed as SseEnvelope);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) await consume(frame);
      if (done) break;
    }
    if (buffer.trim()) await consume(buffer);
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function encodeSse(event: SseEnvelope): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function encodeSseComment(comment = "ping"): Uint8Array {
  return new TextEncoder().encode(`: ${comment}\n\n`);
}
