import { describe, expect, it } from 'vitest';
import { formatSseEvent, SseConnections } from '../src/http/sse.js';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

describe('formatSseEvent', () => {
  it('writes id, event and a single JSON data line', () => {
    expect(formatSseEvent({ id: '42', event: 'message.created', data: { text: 'a\nb' } })).toBe(
      'id: 42\nevent: message.created\ndata: {"text":"a\\nb"}\n\n',
    );
  });

  it('omits id when not given', () => {
    expect(formatSseEvent({ event: 'message.updated', data: 1 })).toBe(
      'event: message.updated\ndata: 1\n\n',
    );
  });
});

describe('SseConnections', () => {
  it('forgets closed responses and ends the rest on closeAll', () => {
    const connections = new SseConnections();
    const make = () => {
      const res = new EventEmitter() as EventEmitter & { end: () => void; ended: boolean };
      res.ended = false;
      res.end = () => {
        res.ended = true;
      };
      return res;
    };
    const a = make();
    const b = make();
    connections.add(a as unknown as ServerResponse);
    connections.add(b as unknown as ServerResponse);
    a.emit('close');
    expect(connections.size).toBe(1);
    connections.closeAll();
    expect(b.ended).toBe(true);
    expect(a.ended).toBe(false);
    expect(connections.size).toBe(0);
  });
});
