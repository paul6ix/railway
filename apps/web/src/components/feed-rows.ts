import type { ChatMessage } from '@app/shared';

/** Consecutive messages from one author within this window share a single header. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface FeedRow {
  message: ChatMessage;
  /** First message of an author run: show the avatar and name. */
  startsGroup: boolean;
  /** Set on the first message of each calendar day (local time). */
  dayLabel?: string;
}

const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(now)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return longDate.format(date);
}

export function buildFeedRows(messages: ChatMessage[], now: Date = new Date()): FeedRow[] {
  return messages.map((message, i) => {
    const prev = messages[i - 1];
    const created = new Date(message.createdAt);
    const newDay = !prev || dayKey(new Date(prev.createdAt)) !== dayKey(created);
    const startsGroup =
      newDay ||
      prev.authorId !== message.authorId ||
      created.getTime() - new Date(prev.createdAt).getTime() > GROUP_WINDOW_MS;
    return {
      message,
      startsGroup,
      ...(newDay ? { dayLabel: formatDayLabel(created, now) } : {}),
    };
  });
}

/** Stable colour per author for avatars without an image. */
export function authorHue(authorId: string): number {
  let hash = 0;
  for (const ch of authorId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}
