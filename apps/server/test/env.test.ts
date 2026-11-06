import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../src/env.js';

const valid = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/discord_stream',
  DISCORD_TOKEN: 'token',
  DISCORD_CHANNEL_ID: '123456789012345678',
};

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.DISCORD_CHANNEL_ID).toBe(valid.DISCORD_CHANNEL_ID);
  });

  it('coerces PORT from a string', () => {
    expect(loadEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('throws an EnvError naming every missing variable', () => {
    expect(() => loadEnv({})).toThrow(EnvError);
    try {
      loadEnv({});
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('DISCORD_TOKEN');
      expect(message).toContain('DISCORD_CHANNEL_ID');
    }
  });

  it('rejects a channel ID that is not a snowflake', () => {
    expect(() => loadEnv({ ...valid, DISCORD_CHANNEL_ID: 'general' })).toThrow(/snowflake/);
  });
});
