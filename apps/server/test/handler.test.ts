import { describe, expect, it, vi } from 'vitest';
import {
  createMessageCreateHandler,
  createMessageDeleteHandler,
  createMessageUpdateHandler,
  looksLikeMissingContentIntent,
} from '../src/bot/handler.js';
import type { MessageService } from '../src/messages/service.js';
import { CHANNEL_ID, makeDiscordMessage, makeFakeLogger } from './fakes.js';

function setup(ingest: MessageService['ingest'] = vi.fn(async () => {})) {
  const service = {
    ingest: vi.fn(ingest),
    ingestMany: vi.fn(),
    applyEdit: vi.fn(async () => {}),
    applyDelete: vi.fn(async () => {}),
  };
  const logger = makeFakeLogger();
  const handle = createMessageCreateHandler({ channelId: CHANNEL_ID, service, logger });
  return { service, logger, handle };
}

describe('createMessageCreateHandler', () => {
  it('ingests messages from the watched channel', async () => {
    const { service, handle } = setup();
    await handle(makeDiscordMessage());
    expect(service.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ id: '300000000000000001' }),
    );
  });

  it('ignores other channels', async () => {
    const { service, handle } = setup();
    await handle(makeDiscordMessage({ channelId: '999999999999999999' }));
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it('ignores system messages (joins, pins)', async () => {
    const { service, handle } = setup();
    await handle(makeDiscordMessage({ system: true }));
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it('logs and swallows ingest failures', async () => {
    const { logger, handle } = setup(async () => {
      throw new Error('db down');
    });
    await expect(handle(makeDiscordMessage())).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('warns once when content looks stripped by a missing intent', async () => {
    const { logger, handle } = setup();
    await handle(makeDiscordMessage({ content: '' }));
    await handle(makeDiscordMessage({ id: '300000000000000002', content: '' }));
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0]?.[1]).toMatch(/Message Content Intent/);
  });
});

describe('looksLikeMissingContentIntent', () => {
  it('is false for normal, bot, attachment-only and embed-only messages', () => {
    expect(looksLikeMissingContentIntent(makeDiscordMessage())).toBe(false);
    expect(
      looksLikeMissingContentIntent(makeDiscordMessage({ content: '', author: { bot: true } })),
    ).toBe(false);
    expect(
      looksLikeMissingContentIntent(
        makeDiscordMessage({
          content: '',
          attachments: [{ id: '1', name: 'a', url: 'https://x.y/a', contentType: null, size: 1 }],
        }),
      ),
    ).toBe(false);
    expect(
      looksLikeMissingContentIntent(makeDiscordMessage({ content: '', embeds: [{}] as never })),
    ).toBe(false);
  });

  it('is true for an empty message from a user', () => {
    expect(looksLikeMissingContentIntent(makeDiscordMessage({ content: '' }))).toBe(true);
  });
});

describe('edit and delete handlers', () => {
  it('applies edits in the watched channel only', async () => {
    const { service, logger } = setup();
    const onUpdate = createMessageUpdateHandler({ channelId: CHANNEL_ID, service, logger });
    await onUpdate(
      makeDiscordMessage({ content: 'edited', editedAt: new Date('2026-11-06T10:05:00Z') }),
    );
    await onUpdate(makeDiscordMessage({ channelId: '999999999999999999' }));
    expect(service.applyEdit).toHaveBeenCalledOnce();
    expect(service.applyEdit).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'edited', editedAt: '2026-11-06T10:05:00.000Z' }),
    );
  });

  it('applies deletes in the watched channel only and swallows failures', async () => {
    const { service, logger } = setup();
    const onDelete = createMessageDeleteHandler({ channelId: CHANNEL_ID, service, logger });
    await onDelete({ id: '300000000000000001', channelId: CHANNEL_ID });
    await onDelete({ id: '300000000000000002', channelId: '999999999999999999' });
    expect(service.applyDelete).toHaveBeenCalledOnce();
    expect(service.applyDelete).toHaveBeenCalledWith('300000000000000001');

    service.applyDelete.mockRejectedValueOnce(new Error('db down'));
    await expect(
      onDelete({ id: '300000000000000003', channelId: CHANNEL_ID }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
