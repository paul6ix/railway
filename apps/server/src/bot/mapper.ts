import type { ChatMessage } from '@app/shared';

/**
 * The parts of a discord.js `Message` the mapper reads. Declared structurally so tests
 * don't need to construct real discord.js objects.
 */
export interface DiscordMessageLike {
  id: string;
  channelId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  system: boolean;
  author: {
    id: string;
    bot: boolean;
    username: string;
    globalName: string | null;
    displayAvatarURL(options?: { size?: number }): string;
  };
  /** Present for guild messages when the member is cached; carries the server nickname. */
  member: { displayName: string } | null;
  attachments: {
    values(): Iterable<{
      id: string;
      name: string;
      url: string;
      contentType: string | null;
      size: number;
    }>;
  };
  embeds: { length: number };
  stickers: { size: number };
}

export function toChatMessage(message: DiscordMessageLike): ChatMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.author.id,
    authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    authorAvatarUrl: message.author.displayAvatarURL({ size: 64 }),
    content: message.content,
    attachments: Array.from(message.attachments.values(), (a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      contentType: a.contentType,
      size: a.size,
    })),
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: null,
  };
}
