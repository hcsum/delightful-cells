import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeWorkersAiStream,
  extractStreamDelta,
  extractStreamUsage,
} from '../llm-worker/src/stream.ts';

test('keeps content separate from reasoning and captures terminal usage', async () => {
  const frames = [
    { choices: [{ delta: { reasoning_content: 'private', content: '' } }] },
    { choices: [{ delta: { content: '{"type":"final"}' } }] },
    { choices: [], usage: { prompt_tokens: 7, completion_tokens: 3, neurons: 2.5 } },
  ];
  const encoded = new TextEncoder().encode(
    frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n',
  );
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded.slice(0, 17));
      controller.enqueue(encoded.slice(17));
      controller.close();
    },
  });
  let content = '';
  let usage = null;
  await consumeWorkersAiStream(stream, (chunk) => {
    content += extractStreamDelta(chunk);
    usage = extractStreamUsage(chunk) ?? usage;
  });
  assert.equal(content, '{"type":"final"}');
  assert.deepEqual(usage, { inputTokens: 7, outputTokens: 3, neurons: 2.5 });
});

test('keeps token usage when a stream omits neurons', () => {
  assert.deepEqual(
    extractStreamUsage({ usage: { prompt_tokens: 7, completion_tokens: 3 } }),
    { inputTokens: 7, outputTokens: 3, neurons: 0 },
  );
});

test('cancels the upstream reader when a chunk handler fails', async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"response":"ok"}\n\n'));
    },
    cancel() {
      canceled = true;
    },
  });
  await assert.rejects(
    () => consumeWorkersAiStream(stream, () => { throw new Error('invalid terminal event'); }),
    /invalid terminal event/,
  );
  assert.equal(canceled, true);
});
