import { describe, expect, it, vi } from 'vitest';
import { createMessageBus, type MessageEvent } from '../src/messages/bus.js';
import { createMessageService } from '../src/messages/service.js';
import { makeChatMessage, makeFakeRepo } from './fakes.js';

function setup() {
  const repo = makeFakeRepo();
  const bus = createMessageBus();
  const events: MessageEvent[] = [];
  bus.subscribe((e) => events.push(e));
  return { repo, bus, events, service: createMessageService({ repo, bus }) };
}

describe('MessageService', () => {
  it('persists then publishes message.created', async () => {
    const { repo, events, service } = setup();
    const message = makeChatMessage('300000000000000001');
    await service.ingest(message);
    expect(repo.rows.get(message.id)).toEqual(message);
    expect(events).toEqual([{ name: 'message.created', message }]);
  });

  it('does not publish when persisting fails', async () => {
    const { repo, events, service } = setup();
    vi.spyOn(repo, 'upsert').mockRejectedValueOnce(new Error('db down'));
    await expect(service.ingest(makeChatMessage('300000000000000001'))).rejects.toThrow('db down');
    expect(events).toEqual([]);
  });

  it('ingestMany ingests in snowflake order regardless of input order', async () => {
    const { events, service } = setup();
    const ids = ['99999999999999999', '100000000000000005', '100000000000000000'];
    await service.ingestMany(ids.map((id) => makeChatMessage(id)));
    expect(events.map((e) => e.message.id)).toEqual([
      '99999999999999999',
      '100000000000000000',
      '100000000000000005',
    ]);
  });
});

describe('MessageService edits and deletes', () => {
  it('publishes message.updated for edits to stored messages only', async () => {
    const { events, service } = setup();
    const message = makeChatMessage('300000000000000001');
    await service.ingest(message);
    events.length = 0;

    await service.applyEdit({ ...message, content: 'edited' });
    await service.applyEdit(makeChatMessage('300000000000000099'));
    expect(events).toEqual([
      { name: 'message.updated', message: { ...message, content: 'edited' } },
    ]);
  });

  it('publishes message.deleted with content removed, once', async () => {
    const { events, service } = setup();
    await service.ingest(makeChatMessage('300000000000000001'));
    events.length = 0;

    const at = new Date('2026-11-06T11:00:00.000Z');
    await service.applyDelete('300000000000000001', at);
    await service.applyDelete('300000000000000001', at);
    await service.applyDelete('300000000000000099', at);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'message.deleted',
      message: { id: '300000000000000001', content: '', deletedAt: at.toISOString() },
    });
  });
});

describe('MessageBus', () => {
  it('stops delivering after unsubscribe', () => {
    const bus = createMessageBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);
    expect(bus.listenerCount()).toBe(1);
    unsubscribe();
    bus.publish({ name: 'message.created', message: makeChatMessage('300000000000000001') });
    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount()).toBe(0);
  });

  it('keeps delivering to other listeners when one throws', () => {
    const onError = vi.fn();
    const bus = createMessageBus(onError);
    const healthy = vi.fn();
    bus.subscribe(() => {
      throw new Error('socket closed');
    });
    bus.subscribe(healthy);
    bus.publish({ name: 'message.created', message: makeChatMessage('300000000000000001') });
    expect(healthy).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });
});
