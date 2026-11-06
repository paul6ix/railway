import { compareSnowflakes, type ChatMessage } from '@app/shared';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'error';

export interface MessagesState {
  /** Sorted oldest → newest, unique by id. */
  messages: ChatMessage[];
  status: ConnectionStatus;
  hasOlder: boolean;
  loadingOlder: boolean;
}

export type MessagesAction =
  | { type: 'history'; messages: ChatMessage[]; hasOlder: boolean }
  | { type: 'olderRequested' }
  | { type: 'older'; messages: ChatMessage[]; hasOlder: boolean }
  | { type: 'olderFailed' }
  | { type: 'upsert'; message: ChatMessage }
  | { type: 'status'; status: ConnectionStatus };

export const initialMessagesState: MessagesState = {
  messages: [],
  status: 'connecting',
  hasOlder: false,
  loadingOlder: false,
};

/** Merge by id (incoming wins, so edits/deletes replace the old copy) and keep snowflake order. */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => compareSnowflakes(a.id, b.id));
}

export function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'history':
      // Keep anything that streamed in while history was loading.
      return {
        ...state,
        messages: mergeMessages(state.messages, action.messages),
        hasOlder: action.hasOlder,
      };
    case 'olderRequested':
      return { ...state, loadingOlder: true };
    case 'older':
      return {
        ...state,
        messages: mergeMessages(state.messages, action.messages),
        hasOlder: action.hasOlder,
        loadingOlder: false,
      };
    case 'olderFailed':
      return { ...state, loadingOlder: false };
    case 'upsert':
      return { ...state, messages: mergeMessages(state.messages, [action.message]) };
    case 'status':
      return state.status === action.status ? state : { ...state, status: action.status };
  }
}
