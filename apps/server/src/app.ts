import type { HealthResponse } from '@app/shared';
import Fastify, { type FastifyInstance } from 'fastify';

export interface AppOptions {
  logLevel?: string;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } });

  app.get('/api/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  });

  return app;
}
