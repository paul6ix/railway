import { STREAM_EVENTS } from '@app/shared';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { fetchMessages, PAGE_SIZE, parseStreamMessage, STREAM_URL } from './client';
import { initialMessagesState, messagesReducer, type MessagesState } from './messages-state';

export interface UseMessageStreamOptions {
  /** Delay before re-opening a stream the browser gave up on, or retrying failed history. */
  retryMs?: number;
}

export interface UseMessageStreamResult extends MessagesState {
  loadOlder(): Promise<void>;
}

/**
 * Loads recent history, then follows the live SSE stream.
 *
 * The stream is opened with `?lastEventId=<newest history id>` so the server replays anything
 * posted between the history request and the stream connecting. After that the browser's own
 * reconnect sends the `Last-Event-ID` header, so drops are gap-free too.
 */
export function useMessageStream(options: UseMessageStreamOptions = {}): UseMessageStreamResult {
  const retryMs = options.retryMs ?? 3000;
  const [state, dispatch] = useReducer(messagesReducer, initialMessagesState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    // Newest message id seen, from history or the stream: the resume cursor.
    let cursor: string | undefined;

    const track = (id: string) => {
      if (!cursor || BigInt(id) > BigInt(cursor)) cursor = id;
    };

    const scheduleRetry = (fn: () => void) => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!cancelled) fn();
      }, retryMs);
    };

    const connect = () => {
      source?.close();
      const url = cursor ? `${STREAM_URL}?lastEventId=${cursor}` : STREAM_URL;
      const es = new EventSource(url);
      source = es;

      es.onopen = () => dispatch({ type: 'status', status: 'live' });
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          // The browser won't retry (e.g. a non-200 response); do it ourselves.
          dispatch({ type: 'status', status: 'error' });
          scheduleRetry(connect);
        } else {
          dispatch({ type: 'status', status: 'reconnecting' });
        }
      };
      for (const name of Object.values(STREAM_EVENTS)) {
        es.addEventListener(name, (event) => {
          const message = parseStreamMessage((event as MessageEvent<string>).data);
          if (!message) return;
          if (name === STREAM_EVENTS.created) track(message.id);
          dispatch({ type: 'upsert', message });
        });
      }
    };

    const start = async () => {
      try {
        const history = await fetchMessages({ limit: PAGE_SIZE, signal: abort.signal });
        if (cancelled) return;
        for (const message of history) track(message.id);
        dispatch({ type: 'history', messages: history, hasOlder: history.length === PAGE_SIZE });
        connect();
      } catch {
        if (cancelled) return;
        dispatch({ type: 'status', status: 'error' });
        scheduleRetry(() => void start());
      }
    };

    void start();
    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [retryMs]);

  const loadOlder = useCallback(async () => {
    const { messages, loadingOlder, hasOlder } = stateRef.current;
    const oldest = messages[0];
    if (loadingOlder || !hasOlder || !oldest) return;
    dispatch({ type: 'olderRequested' });
    try {
      const older = await fetchMessages({ before: oldest.id, limit: PAGE_SIZE });
      dispatch({ type: 'older', messages: older, hasOlder: older.length === PAGE_SIZE });
    } catch {
      dispatch({ type: 'olderFailed' });
    }
  }, []);

  return { ...state, loadOlder };
}
