import type { FastifyInstance } from 'fastify';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp } from './app-harness.js';

describe('static web serving', () => {
  let dir: string;
  let app: FastifyInstance | undefined;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'web-dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>app</title>');
    writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log(1)');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  afterEach(async () => {
    await app?.close();
  });

  it('serves index.html at / without long-term caching', async () => {
    ({ app } = await makeTestApp({ webDistDir: dir }));
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>app</title>');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('serves fingerprinted assets as immutable', async () => {
    ({ app } = await makeTestApp({ webDistDir: dir }));
    const res = await app.inject({ method: 'GET', url: '/assets/index-abc.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('falls back to index.html for client routes but 404s unknown API paths', async () => {
    ({ app } = await makeTestApp({ webDistDir: dir }));
    expect((await app.inject({ method: 'GET', url: '/some/page' })).body).toContain(
      '<title>app</title>',
    );
    const api = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'Not Found' });
  });

  it('serves the API only when there is no web build', async () => {
    ({ app } = await makeTestApp({ webDistDir: join(dir, 'missing') }));
    expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  });
});
