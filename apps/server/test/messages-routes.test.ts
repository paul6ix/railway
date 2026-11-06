import { STREAM_EVENTS } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { makeTestApp, SseClient } from './app-harness.js';
import { makeChatMessage } from './fakes.js';

type TestApp = Awaited<ReturnType<typeof makeTestApp>>;

const ids = ['99999999999999990', '99999999999999999', '100000000000000000', '100000000000000005'];

describe('GET /api/messages', () => {
  let ctx: TestApp | undefined;
  afterEach(async () => {
    await ctx?.app.close();
  });

  it('returns the newest messages oldest-first, defaulting to 50', async () => {
    ctx = await makeTestApp();
    for (const id of ids) await ctx.repo.upsert(makeChatMessage(id));
    const res = await ctx.app.inject({ method: 'GET', url: '/api/messages?limit=3' });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((m: { id: string }) => m.id)).toEqual(ids.slice(1));
  });

  it('pages back with before', async () => {
    ctx = await makeTestApp();
    for (const id of ids) await ctx.repo.upsert(makeChatMessage(id));
    const res = await ctx.app.inject({ method: 'GET', url: `/api/messages?before=${ids[2]}` });
    expect(res.json().map((m: { id: string }) => m.id)).toEqual(ids.slice(0, 2));
  });

  it.each(['limit=0', 'limit=101', 'limit=abc', 'before=not-a-snowflake'])(
    'rejects invalid query %s with 400',
    async (query) => {
      ctx = await makeTestApp();
      const res = await ctx.app.inject({ method: 'GET', url: `/api/messages?${query}` });
      expect(res.statusCode).toBe(400);
    },
  );
});

describe('GET /api/messages/stream', () => {
  let ctx: TestApp | undefined;
  let client: SseClient | undefined;
  afterEach(async () => {
    client?.close();
    await ctx?.app.close();
  });

  async function start(options?: { heartbeatMs?: number }) {
    ctx = await makeTestApp(options);
    await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    return ctx;
  }

  it('sends SSE headers and pushes live messages with the snowflake as event id', async () => {
    const { app, bus } = await start();
    client = await SseClient.connect(app, '/api/messages/stream');
    expect(client.statusCode).toBe(200);
    expect(client.headers['content-type']).toMatch(/^text\/event-stream/);

    await client.waitFor(() => bus.listenerCount() === 1);
    const message = makeChatMessage(ids[0]!);
    bus.publish({ name: STREAM_EVENTS.created, message });

    await client.waitFor((c) => c.events.length === 1);
    expect(client.events[0]).toEqual({ id: ids[0], event: 'message.created', data: message });
  });

  it('replays messages after the Last-Event-ID header, then continues live without duplicates', async () => {
    const { app, repo, bus } = await start();
    for (const id of ids) await repo.upsert(makeChatMessage(id));

    client = await SseClient.connect(app, '/api/messages/stream', { 'Last-Event-ID': ids[1]! });
    await client.waitFor((c) => c.events.length === 2);
    expect(client.events.map((e) => e.id)).toEqual(ids.slice(2));

    // A duplicate of something already replayed is dropped; a newer one is delivered.
    bus.publish({ name: STREAM_EVENTS.created, message: makeChatMessage(ids[3]!) });
    bus.publish({ name: STREAM_EVENTS.created, message: makeChatMessage('100000000000000009') });
    await client.waitFor((c) => c.events.length === 3);
    expect(client.events.map((e) => e.id)).toEqual([ids[2], ids[3], '100000000000000009']);
  });

  it('accepts the cursor as ?lastEventId= for the first connection', async () => {
    const { app, repo } = await start();
    for (const id of ids) await repo.upsert(makeChatMessage(id));
    client = await SseClient.connect(app, `/api/messages/stream?lastEventId=${ids[2]}`);
    await client.waitFor((c) => c.events.length === 1);
    expect(client.events.map((e) => e.id)).toEqual([ids[3]]);
  });

  it('prefers the Last-Event-ID header over the query on reconnect', async () => {
    const { app, repo } = await start();
    for (const id of ids) await repo.upsert(makeChatMessage(id));
    client = await SseClient.connect(app, `/api/messages/stream?lastEventId=${ids[0]}`, {
      'Last-Event-ID': ids[2]!,
    });
    await client.waitFor((c) => c.events.length === 1);
    expect(client.events.map((e) => e.id)).toEqual([ids[3]]);
  });

  it('does not lose messages published while the replay query is running', async () => {
    const { app, repo, bus } = await start();
    await repo.upsert(makeChatMessage(ids[1]!));
    const realListAfter = repo.listAfter;
    repo.listAfter = async (options) => {
      const result = await realListAfter(options);
      // Simulate a message arriving between the DB read and the switch to live mode.
      bus.publish({ name: STREAM_EVENTS.created, message: makeChatMessage(ids[2]!) });
      return result;
    };
    client = await SseClient.connect(app, '/api/messages/stream', { 'Last-Event-ID': ids[0]! });
    await client.waitFor((c) => c.events.length === 2);
    expect(client.events.map((e) => e.id)).toEqual([ids[1], ids[2]]);
  });

  it('sends heartbeat comments', async () => {
    const { app } = await start({ heartbeatMs: 20 });
    client = await SseClient.connect(app, '/api/messages/stream');
    await client.waitFor((c) => c.raw.includes(': ping'));
  });

  it('unsubscribes from the bus when the client disconnects', async () => {
    const { app, bus } = await start();
    client = await SseClient.connect(app, '/api/messages/stream');
    await client.waitFor(() => bus.listenerCount() === 1);
    client.close();
    const deadline = Date.now() + 2000;
    while (bus.listenerCount() !== 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(bus.listenerCount()).toBe(0);
  });

  it('ends open streams when the app closes instead of hanging', async () => {
    const { app } = await start();
    client = await SseClient.connect(app, '/api/messages/stream');
    await app.close();
    await client.waitFor((c) => c.isClosed);
  });
});
