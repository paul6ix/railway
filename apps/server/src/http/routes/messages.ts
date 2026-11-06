import { snowflakeSchema, STREAM_EVENTS, type ChatMessage } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MessageBus, MessageEvent } from '../../messages/bus.js';
import type { MessageRepo } from '../../messages/repository.js';
import { formatSseEvent, SSE_HEADERS, type SseConnections } from '../sse.js';

export const MAX_PAGE_SIZE = 100;
/** Upper bound on messages replayed to one reconnecting client. */
export const MAX_REPLAY = 500;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
  before: snowflakeSchema.optional(),
});

const streamQuerySchema = z.object({
  /** Initial resume cursor for a fresh EventSource (it can't set headers on the first request). */
  lastEventId: snowflakeSchema.optional(),
});

export interface MessageRouteDeps {
  channelId: string;
  repo: MessageRepo;
  bus: MessageBus;
  connections: SseConnections;
  heartbeatMs: number;
}

export function registerMessageRoutes(app: FastifyInstance, deps: MessageRouteDeps): void {
  app.get('/api/messages', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', issues: parsed.error.issues });
    }
    const { limit, before } = parsed.data;
    return deps.repo.listRecent({ channelId: deps.channelId, limit, before });
  });

  app.get('/api/messages/stream', async (request, reply) => {
    const query = streamQuerySchema.safeParse(request.query);
    const header = request.headers['last-event-id'];
    // On automatic reconnects the browser sends the Last-Event-ID header, which is newer than the query.
    const headerCursor = snowflakeSchema.safeParse(Array.isArray(header) ? header[0] : header);
    const cursor = headerCursor.success
      ? headerCursor.data
      : query.success
        ? query.data.lastEventId
        : undefined;

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, SSE_HEADERS);
    res.write('retry: 3000\n\n');
    deps.connections.add(res);

    // Track the newest created-id sent so nothing is delivered twice across replay and live.
    let lastSentId = cursor ? BigInt(cursor) : -1n;
    const send = ({ name, message }: MessageEvent) => {
      if (name === STREAM_EVENTS.created) {
        const id = BigInt(message.id);
        if (id <= lastSentId) return;
        lastSentId = id;
        res.write(formatSseEvent({ event: name, data: message, id: message.id }));
      } else {
        // Edits and deletes refer to existing messages; don't move the resume cursor.
        res.write(formatSseEvent({ event: name, data: message }));
      }
    };

    // Subscribe *before* reading the replay so messages arriving meanwhile are buffered, not lost.
    let buffer: MessageEvent[] | null = [];
    const unsubscribe = deps.bus.subscribe((event) => {
      if (buffer) buffer.push(event);
      else send(event);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), deps.heartbeatMs);
    res.once('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    try {
      if (cursor) {
        const missed: ChatMessage[] = await deps.repo.listAfter({
          channelId: deps.channelId,
          after: cursor,
          limit: MAX_REPLAY,
        });
        for (const message of missed) send({ name: STREAM_EVENTS.created, message });
      }
    } catch (error) {
      request.log.error({ err: error }, 'SSE replay failed');
    } finally {
      const pending = buffer;
      buffer = null;
      for (const event of pending) send(event);
    }
  });
}
