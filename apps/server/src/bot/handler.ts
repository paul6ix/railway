import type { Logger } from '../logger.js';
import type { MessageService } from '../messages/service.js';
import { toChatMessage, type DiscordMessageLike } from './mapper.js';

/**
 * Without the privileged Message Content intent, Discord delivers messages from other users
 * with empty content and no attachments or embeds. Nothing errors, the feed is just blank,
 * so we look for that shape and warn once.
 */
export function looksLikeMissingContentIntent(message: DiscordMessageLike): boolean {
  return (
    !message.author.bot &&
    message.content === '' &&
    message.attachments.values()[Symbol.iterator]().next().done === true &&
    message.embeds.length === 0 &&
    message.stickers.size === 0
  );
}

export interface MessageHandlerDeps {
  channelId: string;
  service: MessageService;
  logger: Logger;
}

/** Handles a `messageCreate` gateway event. Never throws: one bad message must not kill the bot. */
export function createMessageCreateHandler(deps: MessageHandlerDeps) {
  let warnedAboutIntent = false;

  return async function onMessageCreate(message: DiscordMessageLike): Promise<void> {
    if (message.channelId !== deps.channelId || message.system) return;

    if (!warnedAboutIntent && looksLikeMissingContentIntent(message)) {
      warnedAboutIntent = true;
      deps.logger.warn(
        { messageId: message.id },
        'Received a message with empty content. Enable the "Message Content Intent" for the bot in the Discord Developer Portal.',
      );
    }

    try {
      await deps.service.ingest(toChatMessage(message));
    } catch (error) {
      deps.logger.error({ err: error, messageId: message.id }, 'failed to ingest message');
    }
  };
}
