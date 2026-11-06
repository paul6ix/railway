import type { ServerResponse } from 'node:http';

export interface SseEvent {
  /** Event name (`event:` field). */
  event: string;
  data: unknown;
  /** Sets the client's Last-Event-ID. Omit for events that must not move the resume cursor. */
  id?: string;
}

/** Serialise one event in the text/event-stream wire format. */
export function formatSseEvent({ event, data, id }: SseEvent): string {
  let out = '';
  if (id !== undefined) out += `id: ${id}\n`;
  out += `event: ${event}\n`;
  // JSON.stringify never emits raw newlines, so the payload is always a single data: line.
  out += `data: ${JSON.stringify(data)}\n\n`;
  return out;
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Stop reverse proxies (nginx-style) from buffering the stream.
  'X-Accel-Buffering': 'no',
} as const;

/** Tracks open SSE responses so shutdown can end them instead of waiting forever. */
export class SseConnections {
  private readonly open = new Set<ServerResponse>();

  add(res: ServerResponse): void {
    this.open.add(res);
    res.once('close', () => this.open.delete(res));
  }

  get size(): number {
    return this.open.size;
  }

  closeAll(): void {
    for (const res of this.open) res.end();
    this.open.clear();
  }
}
