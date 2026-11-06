import type { ChatMessage } from '@app/shared';

export function makeMessage(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    channelId: '100000000000000001',
    authorId: '200000000000000001',
    authorName: 'Alice',
    authorAvatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
    content: `message ${id}`,
    attachments: [],
    createdAt: '2026-11-06T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

/** Sequential snowflake-shaped ids. */
export function ids(count: number, start = 100000000000000000n): string[] {
  return Array.from({ length: count }, (_, i) => String(start + BigInt(i)));
}

type Listener = (event: MessageEvent<string>) => void;

export class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  static latest(): FakeEventSource {
    const latest = FakeEventSource.instances.at(-1);
    if (!latest) throw new Error('No EventSource was opened');
    return latest;
  }

  readyState = FakeEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: Listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  // Test controls
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.(new Event('open'));
  }

  emit(name: string, data: unknown, id?: string) {
    const event = new MessageEvent(name, {
      data: typeof data === 'string' ? data : JSON.stringify(data),
      lastEventId: id,
    });
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }

  fail({ permanently }: { permanently: boolean }) {
    this.readyState = permanently ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.onerror?.(new Event('error'));
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
