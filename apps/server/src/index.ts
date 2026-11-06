import { buildApp } from './app.js';
import { createDiscordBot } from './bot/client.js';
import { createPrismaClient } from './db.js';
import { loadEnv } from './env.js';
import { DEFAULT_WEB_DIST_DIR } from './http/static.js';
import { createMessageBus } from './messages/bus.js';
import { createPrismaMessageRepo } from './messages/repository.js';
import { createMessageService } from './messages/service.js';
import { describeStartupError } from './startup-errors.js';

/** Railway sends SIGTERM and kills the container shortly after; don't let cleanup hang past that. */
const SHUTDOWN_TIMEOUT_MS = 5000;

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const repo = createPrismaMessageRepo(prisma);
  // `app` and `bot` are referenced lazily below: these callbacks only run after both exist.
  const bus = createMessageBus((error) => app.log.error({ err: error }, 'message listener failed'));
  const app = await buildApp(
    {
      channelId: env.DISCORD_CHANNEL_ID,
      repo,
      bus,
      health: {
        checkDatabase: async () => {
          await prisma.$queryRaw`SELECT 1`;
          return true;
        },
        isDiscordReady: () => bot.isReady(),
      },
    },
    { logLevel: env.LOG_LEVEL, webDistDir: env.WEB_DIST_DIR ?? DEFAULT_WEB_DIST_DIR },
  );

  const service = createMessageService({ repo, bus });
  const bot = createDiscordBot({
    token: env.DISCORD_TOKEN,
    channelId: env.DISCORD_CHANNEL_ID,
    service,
    logger: app.log.child({ module: 'discord' }),
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    const forceExit = setTimeout(() => {
      app.log.error('shutdown timed out; exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();
    try {
      await app.close(); // also ends open SSE streams (preClose hook)
      await bot.stop();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: env.PORT });
  await bot.start();
}

main().catch((error: unknown) => {
  // Fail fast on bad configuration: on Railway a crashing deploy fails its healthcheck,
  // so the previous healthy deployment keeps serving instead of a half-working one.
  console.error(describeStartupError(error) ?? error);
  process.exit(1);
});
