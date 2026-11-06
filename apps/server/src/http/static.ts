import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** apps/web/dist, resolved from this file's location in both src/ (tsx) and dist/ (node). */
export const DEFAULT_WEB_DIST_DIR = fileURLToPath(new URL('../../../web/dist', import.meta.url));

/**
 * Serve the built React app from the same origin as the API, so the browser needs no CORS
 * and the deploy is a single Railway service. Unknown non-API paths fall back to index.html.
 */
export async function registerStaticWeb(app: FastifyInstance, root: string): Promise<boolean> {
  if (!existsSync(`${root}/index.html`)) {
    app.log.warn({ root }, 'web build not found; serving API only (run `pnpm build`)');
    return false;
  }

  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    cacheControl: false, // we set Cache-Control ourselves below
    setHeaders(res, filePath) {
      // Vite fingerprints everything in assets/, so it can be cached forever; index.html must not be.
      res.setHeader(
        'Cache-Control',
        filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found' });
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });
  return true;
}
