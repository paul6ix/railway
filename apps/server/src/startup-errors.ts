import { EnvError } from './env.js';

/**
 * Turn the configuration mistakes people actually hit into one actionable line.
 * Returns null for anything unexpected, which is then logged with its full stack.
 */
export function describeStartupError(error: unknown): string | null {
  if (error instanceof EnvError) return error.message;
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'TokenInvalid') {
    return 'Discord rejected DISCORD_TOKEN. Reset the token under Developer Portal → your app → Bot, then update the env var.';
  }
  if (code === 'DisallowedIntents' || code === 4014) {
    return 'Discord refused the Message Content intent. Enable "Message Content Intent" under Developer Portal → your app → Bot → Privileged Gateway Intents.';
  }
  return null;
}
