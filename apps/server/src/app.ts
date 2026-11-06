import Fastify, { type FastifyInstance } from 'fastify';
import type { MessageBus } from './messages/bus.js';
import type { MessageRepo } from './messages/repository.js';
import { registerHealthRoute, type HealthChecks } from './http/routes/health.js';
import { registerMessageRoutes } from './http/routes/messages.js';
import { SseConnections } from './http/sse.js';

export interface AppDeps {
  channelId: string;
  repo: MessageRepo;
  bus: MessageBus;
  health: HealthChecks;
}

export interface AppOptions {
  logLevel?: string;
  /** Interval between SSE keep-alive comments. Railway's proxy drops idle connections. */
  heartbeatMs?: number;
}

export function buildApp(deps: AppDeps, options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } });
  const connections = new SseConnections();

  // SSE responses never finish on their own; end them so app.close() doesn't hang.
  app.addHook('preClose', async () => connections.closeAll());

  registerHealthRoute(app, deps.health);
  registerMessageRoutes(app, {
    channelId: deps.channelId,
    repo: deps.repo,
    bus: deps.bus,
    connections,
    heartbeatMs: options.heartbeatMs ?? 25_000,
  });

  return app;
}
