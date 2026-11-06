import type { HealthResponse } from '@app/shared';
import type { FastifyInstance } from 'fastify';

export interface HealthChecks {
  /** Resolves true when the database answers a trivial query. */
  checkDatabase(): Promise<boolean>;
  isDiscordReady(): boolean;
}

export function registerHealthRoute(app: FastifyInstance, checks: HealthChecks): void {
  app.get('/api/health', async (_request, reply): Promise<HealthResponse> => {
    const databaseOk = await checks.checkDatabase().catch(() => false);
    const discordOk = checks.isDiscordReady();
    // 503 only when the database is down: without it we can serve nothing. A Discord outage
    // still leaves history readable, so it is reported but keeps the service "healthy".
    reply.code(databaseOk ? 200 : 503);
    return {
      status: databaseOk && discordOk ? 'ok' : 'degraded',
      database: databaseOk ? 'ok' : 'error',
      discord: discordOk ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
    };
  });
}
