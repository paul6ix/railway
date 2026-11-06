import { chatMessageSchema, type ChatMessage } from '@app/shared';
import { z } from 'zod';

export const PAGE_SIZE = 50;
export const STREAM_URL = '/api/messages/stream';

const messageListSchema = z.array(chatMessageSchema);

export async function fetchMessages(
  options: { before?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: String(options.limit ?? PAGE_SIZE) });
  if (options.before) params.set('before', options.before);
  const res = await fetch(`/api/messages?${params}`, { signal: options.signal });
  if (!res.ok) throw new Error(`GET /api/messages failed with ${res.status}`);
  return messageListSchema.parse(await res.json());
}

/** Parse an SSE `data:` payload; returns null for anything that isn't a valid message. */
export function parseStreamMessage(data: string): ChatMessage | null {
  try {
    const result = chatMessageSchema.safeParse(JSON.parse(data));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
