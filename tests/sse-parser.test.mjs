import assert from 'node:assert/strict';
import test from 'node:test';
import { readSse } from '../lib/cells/sse.ts';

function streamFrom(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

test('parses frames split across arbitrary UTF-8 chunks', async () => {
  const bytes = new TextEncoder().encode(
    'data: {"type":"activity","requestId":"r","seq":1,"at":1,"data":{"text":"表格"}}\n\n',
  );
  const events = [];
  await readSse(streamFrom([...bytes].map((byte) => Uint8Array.of(byte))), (event) => events.push(event));
  assert.equal(events[0].data.text, '表格');
});

test('parses multiple CRLF frames and ignores heartbeat comments', async () => {
  const body = [
    ': ping\r\n\r\n',
    'data: {"type":"accepted","requestId":"r","seq":1,"at":1,"data":{}}\r\n\r\n',
    'data: {"type":"done","requestId":"r","seq":2,"at":2,"data":{}}\r\n\r\n',
  ].join('');
  const events = [];
  await readSse(streamFrom([new TextEncoder().encode(body)]), (event) => events.push(event));
  assert.deepEqual(events.map((event) => event.type), ['accepted', 'done']);
});

test('rejects malformed JSON data', async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {bad}\n\n'));
    },
    cancel() {
      canceled = true;
    },
  });
  await assert.rejects(() => readSse(stream, () => {}), /Malformed SSE event data/);
  assert.equal(canceled, true);
});
