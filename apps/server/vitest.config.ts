import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Pick up TEST_DATABASE_URL etc. from apps/server/.env when running locally.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one database schema; run files serially.
    fileParallelism: false,
  },
});
