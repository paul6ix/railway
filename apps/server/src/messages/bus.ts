import type { ChatMessage, StreamEventName } from '@app/shared';

export interface MessageEvent {
  name: StreamEventName;
  message: ChatMessage;
}

export type MessageListener = (event: MessageEvent) => void;

/**
 * In-process fan-out from the bot to connected SSE clients. Postgres is the source of truth;
 * this only carries "something new happened" to listeners in this process.
 */
export interface MessageBus {
  publish(event: MessageEvent): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: MessageListener): () => void;
  listenerCount(): number;
}

export function createMessageBus(onListenerError?: (error: unknown) => void): MessageBus {
  const listeners = new Set<MessageListener>();
  return {
    publish(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          // One broken client connection must not stop delivery to the others.
          onListenerError?.(error);
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    listenerCount() {
      return listeners.size;
    },
  };
}
