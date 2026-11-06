import type { ChatMessage } from '@app/shared';
import { vi } from 'vitest';
import type { DiscordMessageLike } from '../src/bot/mapper.js';
import type { Logger } from '../src/logger.js';
import type { MessageRepo } from '../src/messages/repository.js';

export const CHANNEL_ID = '100000000000000001';

export function makeChatMessage(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    channelId: CHANNEL_ID,
    authorId: '200000000000000001',
    authorName: 'alice',
    authorAvatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
    content: `message ${id}`,
    attachments: [],
    createdAt: '2026-11-06T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

type Attachment = {
  id: string;
  name: string;
  url: string;
  contentType: string | null;
  size: number;
};

export function makeDiscordMessage(
  overrides: Partial<Omit<DiscordMessageLike, 'author' | 'attachments'>> & {
    author?: Partial<DiscordMessageLike['author']>;
    attachments?: Attachment[];
  } = {},
): DiscordMessageLike {
  const { author, attachments = [], ...rest } = overrides;
  return {
    id: '300000000000000001',
    channelId: CHANNEL_ID,
    content: 'hello world',
    createdAt: new Date('2026-11-06T10:00:00.000Z'),
    editedAt: null,
    system: false,
    member: null,
    embeds: [],
    stickers: { size: 0 },
    ...rest,
    author: {
      id: '200000000000000001',
      bot: false,
      username: 'alice_u',
      globalName: 'Alice',
      displayAvatarURL: () =>
        'https://cdn.discordapp.com/avatars/200000000000000001/abc.png?size=64',
      ...author,
    },
    attachments: new Map(attachments.map((a) => [a.id, a])),
  };
}

export function makeFakeLogger(): Logger & Record<keyof Logger, ReturnType<typeof vi.fn>> {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** In-memory MessageRepo with the same ordering semantics as the Prisma one. */
export function makeFakeRepo(): MessageRepo & { rows: Map<string, ChatMessage> } {
  const rows = new Map<string, ChatMessage>();
  const sorted = (channelId: string) =>
    [...rows.values()]
      .filter((m) => m.channelId === channelId)
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  return {
    rows,
    async upsert(message) {
      rows.set(message.id, message);
    },
    async listRecent({ channelId, limit, before }) {
      const all = sorted(channelId).filter((m) => !before || BigInt(m.id) < BigInt(before));
      return all.slice(-limit);
    },
    async updateIfExists(message) {
      const existing = rows.get(message.id);
      if (!existing || existing.deletedAt) return null;
      const updated = { ...existing, ...message, createdAt: existing.createdAt, deletedAt: null };
      rows.set(message.id, updated);
      return updated;
    },
    async markDeleted(id, deletedAt) {
      const existing = rows.get(id);
      if (!existing || existing.deletedAt) return null;
      const deleted = {
        ...existing,
        content: '',
        attachments: [],
        deletedAt: deletedAt.toISOString(),
      };
      rows.set(id, deleted);
      return deleted;
    },
    async listAfter({ channelId, after, limit }) {
      return sorted(channelId)
        .filter((m) => BigInt(m.id) > BigInt(after))
        .slice(0, limit);
    },
  };
}
