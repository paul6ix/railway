import { buildApp } from './app.js';
import { createDiscordBot } from './bot/client.js';
import { createPrismaClient } from './db.js';
import { EnvError, loadEnv } from './env.js';
import { createMessageBus } from './messages/bus.js';
import { createPrismaMessageRepo } from './messages/repository.js';
import { createMessageService } from './messages/service.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = buildApp({ logLevel: env.LOG_LEVEL });

  const prisma = createPrismaClient(env.DATABASE_URL);
  const repo = createPrismaMessageRepo(prisma);
  const bus = createMessageBus((error) => app.log.error({ err: error }, 'message listener failed'));
  const service = createMessageService({ repo, bus });
  const bot = createDiscordBot({
    token: env.DISCORD_TOKEN,
    channelId: env.DISCORD_CHANNEL_ID,
    service,
    logger: app.log.child({ module: 'discord' }),
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: env.PORT });
  await bot.start();
}

main().catch((error: unknown) => {
  if (error instanceof EnvError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
