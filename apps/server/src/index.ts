import { buildApp } from './app.js';
import { EnvError, loadEnv } from './env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = buildApp({ logLevel: env.LOG_LEVEL });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: env.PORT });
}

main().catch((error: unknown) => {
  if (error instanceof EnvError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
