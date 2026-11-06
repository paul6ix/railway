import { act, renderHook, waitFor } from '@testing-library/react';
import { PAGE_SIZE } from '../src/api/client';
import { useMessageStream } from '../src/api/useMessageStream';
import { FakeEventSource, ids, jsonResponse, makeMessage } from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  FakeEventSource.instances = [];
  fetchMock.mockReset();
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

describe('useMessageStream', () => {
  it('loads history, then opens the stream resuming after the newest message', async () => {
    const history = ids(3).map((id) => makeMessage(id));
    fetchMock.mockResolvedValueOnce(jsonResponse(history));

    const { result } = renderHook(() => useMessageStream());
    expect(result.current.status).toBe('connecting');

    await waitFor(() => expect(result.current.messages).toEqual(history));
    expect(requestedUrls()[0]).toBe(`/api/messages?limit=${PAGE_SIZE}`);
    expect(FakeEventSource.latest().url).toBe(`/api/messages/stream?lastEventId=${history[2]!.id}`);
    expect(result.current.hasOlder).toBe(false);

    act(() => FakeEventSource.latest().open());
    expect(result.current.status).toBe('live');
  });

  it('appends live messages, ignores duplicates and invalid payloads, applies edits and deletes', async () => {
    const [first, second] = ids(2);
    fetchMock.mockResolvedValueOnce(jsonResponse([makeMessage(first!)]));
    const { result } = renderHook(() => useMessageStream());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const es = FakeEventSource.latest();

    act(() => {
      es.emit('message.created', makeMessage(second!), second);
      es.emit('message.created', makeMessage(second!), second);
      es.emit('message.created', '{not json');
      es.emit('message.created', { id: 'nope' });
    });
    expect(result.current.messages.map((m) => m.id)).toEqual([first, second]);

    act(() => es.emit('message.updated', makeMessage(first!, { content: 'edited' })));
    expect(result.current.messages[0]!.content).toBe('edited');

    const deletedAt = '2026-11-06T11:00:00.000Z';
    act(() => es.emit('message.deleted', makeMessage(second!, { content: '', deletedAt })));
    expect(result.current.messages[1]!.deletedAt).toBe(deletedAt);
  });

  it('shows reconnecting while the browser retries on its own', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { result } = renderHook(() => useMessageStream());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    act(() => FakeEventSource.latest().fail({ permanently: false }));
    expect(result.current.status).toBe('reconnecting');
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('reopens a permanently closed stream with the newest cursor, including streamed ids', async () => {
    const [first, streamed] = ids(2);
    fetchMock.mockResolvedValueOnce(jsonResponse([makeMessage(first!)]));
    const { result } = renderHook(() => useMessageStream({ retryMs: 10 }));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const es = FakeEventSource.latest();
    act(() => es.emit('message.created', makeMessage(streamed!), streamed));

    act(() => es.fail({ permanently: true }));
    expect(result.current.status).toBe('error');

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(2));
    expect(FakeEventSource.latest().url).toBe(`/api/messages/stream?lastEventId=${streamed}`);
  });

  it('retries when the history request fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));
    fetchMock.mockResolvedValueOnce(jsonResponse([makeMessage(ids(1)[0]!)]));
    const { result } = renderHook(() => useMessageStream({ retryMs: 10 }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loadOlder prepends the previous page and stops when it is short', async () => {
    const all = ids(PAGE_SIZE + 2).map((id) => makeMessage(id));
    fetchMock.mockResolvedValueOnce(jsonResponse(all.slice(2)));
    const { result } = renderHook(() => useMessageStream());
    await waitFor(() => expect(result.current.messages).toHaveLength(PAGE_SIZE));
    expect(result.current.hasOlder).toBe(true);

    fetchMock.mockResolvedValueOnce(jsonResponse(all.slice(0, 2)));
    await act(() => result.current.loadOlder());

    expect(requestedUrls()[1]).toBe(`/api/messages?limit=${PAGE_SIZE}&before=${all[2]!.id}`);
    expect(result.current.messages).toEqual(all);
    expect(result.current.hasOlder).toBe(false);
    expect(result.current.loadingOlder).toBe(false);
  });

  it('closes the stream on unmount', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { unmount } = renderHook(() => useMessageStream());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    unmount();
    expect(FakeEventSource.latest().readyState).toBe(FakeEventSource.CLOSED);
  });
});
