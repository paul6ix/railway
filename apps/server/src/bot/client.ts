import { Client, Events, GatewayIntentBits, type Message } from 'discord.js';
import type { Logger } from '../logger.js';
import type { MessageService } from '../messages/service.js';
import { createMessageCreateHandler } from './handler.js';
import { toChatMessage } from './mapper.js';

/** How many recent messages to pull from Discord on startup to cover downtime. Discord's max per request. */
export const BACKFILL_LIMIT = 50;

export interface DiscordBotDeps {
  token: string;
  channelId: string;
  service: MessageService;
  logger: Logger;
}

export interface DiscordBot {
  start(): Promise<void>;
  stop(): Promise<void>;
  isReady(): boolean;
}

export function createDiscordBot(deps: DiscordBotDeps): DiscordBot {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const onMessageCreate = createMessageCreateHandler(deps);

  async function backfill(): Promise<void> {
    const channel = await client.channels.fetch(deps.channelId);
    if (!channel?.isTextBased()) {
      deps.logger.error(
        { channelId: deps.channelId },
        'DISCORD_CHANNEL_ID is not a text channel the bot can see. Check the ID and that the bot is in that server.',
      );
      return;
    }
    const recent = await channel.messages.fetch({ limit: BACKFILL_LIMIT });
    const messages = [...recent.values()].filter((m) => !m.system).map(toChatMessage);
    await deps.service.ingestMany(messages);
    deps.logger.info({ count: messages.length }, 'backfilled recent channel history');
  }

  client.once(Events.ClientReady, (ready) => {
    deps.logger.info({ user: ready.user.tag, channelId: deps.channelId }, 'discord bot connected');
    backfill().catch((error: unknown) => {
      deps.logger.error({ err: error }, 'backfill failed');
    });
  });

  client.on(Events.MessageCreate, (message: Message) => void onMessageCreate(message));
  client.on(Events.Error, (error) => deps.logger.error({ err: error }, 'discord client error'));
  client.on(Events.Warn, (warning) => deps.logger.warn({ warning }, 'discord client warning'));

  return {
    async start() {
      await client.login(deps.token);
    },
    async stop() {
      await client.destroy();
    },
    isReady() {
      return client.isReady();
    },
  };
}
