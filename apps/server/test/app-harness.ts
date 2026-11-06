import type { FastifyInstance } from 'fastify';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/app.js';
import type { HealthChecks } from '../src/http/routes/health.js';
import { createMessageBus } from '../src/messages/bus.js';
import { CHANNEL_ID, makeFakeRepo } from './fakes.js';

export function makeTestApp(
  options: { heartbeatMs?: number; health?: Partial<HealthChecks> } = {},
) {
  const repo = makeFakeRepo();
  const bus = createMessageBus();
  const app = buildApp(
    {
      channelId: CHANNEL_ID,
      repo,
      bus,
      health: {
        checkDatabase: async () => true,
        isDiscordReady: () => true,
        ...options.health,
      },
    },
    { logLevel: 'silent', heartbeatMs: options.heartbeatMs ?? 60_000 },
  );
  return { app, repo, bus };
}

export interface ParsedEvent {
  id?: string;
  event?: string;
  data?: unknown;
}

/** Minimal text/event-stream client for tests: records raw text and parsed events. */
export class SseClient {
  raw = '';
  events: ParsedEvent[] = [];
  statusCode = 0;
  headers: http.IncomingHttpHeaders = {};
  private request!: http.ClientRequest;
  private closed = false;
  private waiters: Array<() => void> = [];

  static async connect(app: FastifyInstance, path: string, headers: Record<string, string> = {}) {
    const address = app.server.address() as AddressInfo;
    const client = new SseClient();
    await new Promise<void>((resolve, reject) => {
      client.request = http.get({ host: '127.0.0.1', port: address.port, path, headers }, (res) => {
        client.statusCode = res.statusCode ?? 0;
        client.headers = res.headers;
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => client.onData(chunk));
        res.on('end', () => {
          client.closed = true;
          client.notify();
        });
        resolve();
      });
      client.request.on('error', reject);
    });
    return client;
  }

  get isClosed() {
    return this.closed;
  }

  private onData(chunk: string) {
    this.raw += chunk;
    const blocks = this.raw.split('\n\n');
    this.events = blocks
      .slice(0, -1)
      .map((block) => {
        const event: ParsedEvent = {};
        for (const line of block.split('\n')) {
          if (line.startsWith('id: ')) event.id = line.slice(4);
          if (line.startsWith('event: ')) event.event = line.slice(7);
          if (line.startsWith('data: ')) event.data = JSON.parse(line.slice(6));
        }
        return event;
      })
      .filter((e) => e.event);
    this.notify();
  }

  private notify() {
    for (const waiter of this.waiters.splice(0)) waiter();
  }

  /** Resolve once `predicate` holds, or reject after `timeoutMs`. */
  async waitFor(predicate: (client: SseClient) => boolean, timeoutMs = 2000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(this)) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out. Received so far:\n${this.raw}`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  close() {
    this.request.destroy();
  }
}
