import { z } from 'zod';

/** Discord IDs are 64-bit "snowflakes"; they are sent as decimal strings because they overflow JS numbers. */
export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, 'must be a Discord snowflake ID');

export const attachmentSchema = z.object({
  id: snowflakeSchema,
  name: z.string(),
  url: z.string().url(),
  contentType: z.string().nullable(),
  size: z.number().int().nonnegative(),
});

export const chatMessageSchema = z.object({
  id: snowflakeSchema,
  channelId: snowflakeSchema,
  authorId: snowflakeSchema,
  authorName: z.string(),
  authorAvatarUrl: z.string().url().nullable(),
  content: z.string(),
  attachments: z.array(attachmentSchema),
  /** ISO-8601 timestamps. */
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
});

export type Attachment = z.infer<typeof attachmentSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Event names sent on the SSE stream (`event:` field). */
export const STREAM_EVENTS = {
  created: 'message.created',
  updated: 'message.updated',
  deleted: 'message.deleted',
} as const;

export type StreamEventName = (typeof STREAM_EVENTS)[keyof typeof STREAM_EVENTS];

/** Sort comparator for snowflake IDs (numeric, not lexicographic). */
export function compareSnowflakes(a: string, b: string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
