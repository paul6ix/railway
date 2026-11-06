import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeTestApp } from './app-harness.js';

describe('GET /api/health', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 ok when database and Discord are up', async () => {
    ({ app } = await makeTestApp());
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', database: 'ok', discord: 'connected' });
  });

  it('stays 200 but degraded while Discord is disconnected', async () => {
    ({ app } = await makeTestApp({ health: { isDiscordReady: () => false } }));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'degraded', discord: 'disconnected' });
  });

  it('returns 503 when the database check fails', async () => {
    ({ app } = await makeTestApp({
      health: {
        checkDatabase: async () => {
          throw new Error('connection refused');
        },
      },
    }));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', database: 'error' });
  });
});
