import { compareSnowflakes, STREAM_EVENTS, type ChatMessage } from '@app/shared';
import type { MessageBus } from './bus.js';
import type { MessageRepo } from './repository.js';

export interface MessageService {
  /** Persist a new message, then announce it. Idempotent: re-ingesting the same id is harmless. */
  ingest(message: ChatMessage): Promise<void>;
  /** Ingest a batch (e.g. channel history fetched on startup) in chronological order. */
  ingestMany(messages: ChatMessage[]): Promise<void>;
  /** Apply an edit. Edits to messages we never stored are ignored (they predate our history). */
  applyEdit(message: ChatMessage): Promise<void>;
  /** Tombstone a deleted message and announce it. Unknown ids are ignored. */
  applyDelete(id: string, deletedAt?: Date): Promise<void>;
}

export function createMessageService(deps: { repo: MessageRepo; bus: MessageBus }): MessageService {
  const service: MessageService = {
    async ingest(message) {
      // Persist first: anything a client sees live must also be replayable from the database.
      await deps.repo.upsert(message);
      deps.bus.publish({ name: STREAM_EVENTS.created, message });
    },
    async ingestMany(messages) {
      const ordered = [...messages].sort((a, b) => compareSnowflakes(a.id, b.id));
      for (const message of ordered) await service.ingest(message);
    },
    async applyEdit(message) {
      const updated = await deps.repo.updateIfExists(message);
      if (updated) deps.bus.publish({ name: STREAM_EVENTS.updated, message: updated });
    },
    async applyDelete(id, deletedAt = new Date()) {
      const deleted = await deps.repo.markDeleted(id, deletedAt);
      if (deleted) deps.bus.publish({ name: STREAM_EVENTS.deleted, message: deleted });
    },
  };
  return service;
}
