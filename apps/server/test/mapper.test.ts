import { chatMessageSchema } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { toChatMessage } from '../src/bot/mapper.js';
import { makeDiscordMessage } from './fakes.js';

describe('toChatMessage', () => {
  it('maps a Discord message to a valid ChatMessage', () => {
    const result = toChatMessage(makeDiscordMessage());
    expect(chatMessageSchema.parse(result)).toEqual({
      id: '300000000000000001',
      channelId: '100000000000000001',
      authorId: '200000000000000001',
      authorName: 'Alice',
      authorAvatarUrl: 'https://cdn.discordapp.com/avatars/200000000000000001/abc.png?size=64',
      content: 'hello world',
      attachments: [],
      createdAt: '2026-11-06T10:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    });
  });

  it('prefers server nickname, then global display name, then username', () => {
    expect(toChatMessage(makeDiscordMessage({ member: { displayName: 'Nick' } })).authorName).toBe(
      'Nick',
    );
    expect(toChatMessage(makeDiscordMessage()).authorName).toBe('Alice');
    expect(toChatMessage(makeDiscordMessage({ author: { globalName: null } })).authorName).toBe(
      'alice_u',
    );
  });

  it('maps attachments and edit time', () => {
    const result = toChatMessage(
      makeDiscordMessage({
        editedAt: new Date('2026-11-06T10:05:00.000Z'),
        attachments: [
          {
            id: '400000000000000001',
            name: 'cat.png',
            url: 'https://cdn.discordapp.com/attachments/1/2/cat.png',
            contentType: 'image/png',
            size: 2048,
          },
        ],
      }),
    );
    expect(result.editedAt).toBe('2026-11-06T10:05:00.000Z');
    expect(result.attachments).toEqual([
      {
        id: '400000000000000001',
        name: 'cat.png',
        url: 'https://cdn.discordapp.com/attachments/1/2/cat.png',
        contentType: 'image/png',
        size: 2048,
      },
    ]);
  });
});
