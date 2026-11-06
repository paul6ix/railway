import { attachmentSchema, type ChatMessage } from '@app/shared';
import type { Message, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

export interface ListRecentOptions {
  channelId: string;
  limit: number;
  /** Only messages strictly older than this snowflake (for "load older"). */
  before?: string;
}

export interface ListAfterOptions {
  channelId: string;
  /** Only messages strictly newer than this snowflake (for SSE replay). */
  after: string;
  limit: number;
}

export interface MessageRepo {
  /** Insert or update by snowflake id. Safe to call repeatedly with the same message. */
  upsert(message: ChatMessage): Promise<void>;
  /** The newest `limit` messages (optionally before a cursor), returned oldest first. */
  listRecent(options: ListRecentOptions): Promise<ChatMessage[]>;
  /** Messages newer than `after`, oldest first, capped at `limit`. */
  listAfter(options: ListAfterOptions): Promise<ChatMessage[]>;
  /** Apply an edit to a message we already store. Returns null if we never stored it. */
  updateIfExists(message: ChatMessage): Promise<ChatMessage | null>;
  /**
   * Tombstone a message: keep the row (so ids and ordering stay stable) but drop its content,
   * since the author removed it. Returns null if we never stored it.
   */
  markDeleted(id: string, deletedAt: Date): Promise<ChatMessage | null>;
}

const attachmentsSchema = z.array(attachmentSchema);

export function toChatMessage(row: Message): ChatMessage {
  return {
    id: row.id.toString(),
    channelId: row.channelId.toString(),
    authorId: row.authorId.toString(),
    authorName: row.authorName,
    authorAvatarUrl: row.authorAvatarUrl,
    content: row.content,
    attachments: attachmentsSchema.parse(row.attachments),
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function createPrismaMessageRepo(prisma: PrismaClient): MessageRepo {
  return {
    async upsert(message) {
      const mutable = {
        authorName: message.authorName,
        authorAvatarUrl: message.authorAvatarUrl,
        content: message.content,
        attachments: message.attachments as Prisma.InputJsonValue,
        editedAt: message.editedAt ? new Date(message.editedAt) : null,
        deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
      };
      await prisma.message.upsert({
        where: { id: BigInt(message.id) },
        create: {
          id: BigInt(message.id),
          channelId: BigInt(message.channelId),
          authorId: BigInt(message.authorId),
          createdAt: new Date(message.createdAt),
          ...mutable,
        },
        update: mutable,
      });
    },

    async listRecent({ channelId, limit, before }) {
      const rows = await prisma.message.findMany({
        where: {
          channelId: BigInt(channelId),
          ...(before ? { id: { lt: BigInt(before) } } : {}),
        },
        orderBy: { id: 'desc' },
        take: limit,
      });
      return rows.reverse().map(toChatMessage);
    },

    async updateIfExists(message) {
      const { count } = await prisma.message.updateMany({
        where: { id: BigInt(message.id), deletedAt: null },
        data: {
          authorName: message.authorName,
          authorAvatarUrl: message.authorAvatarUrl,
          content: message.content,
          attachments: message.attachments as Prisma.InputJsonValue,
          editedAt: message.editedAt ? new Date(message.editedAt) : null,
        },
      });
      if (count === 0) return null;
      const row = await prisma.message.findUnique({ where: { id: BigInt(message.id) } });
      return row ? toChatMessage(row) : null;
    },

    async markDeleted(id, deletedAt) {
      const { count } = await prisma.message.updateMany({
        where: { id: BigInt(id), deletedAt: null },
        data: { deletedAt, content: '', attachments: [] },
      });
      if (count === 0) return null;
      const row = await prisma.message.findUnique({ where: { id: BigInt(id) } });
      return row ? toChatMessage(row) : null;
    },

    async listAfter({ channelId, after, limit }) {
      const rows = await prisma.message.findMany({
        where: { channelId: BigInt(channelId), id: { gt: BigInt(after) } },
        orderBy: { id: 'asc' },
        take: limit,
      });
      return rows.map(toChatMessage);
    },
  };
}
