import { describe, expect, it } from 'vitest';
import { chatMessageSchema, compareSnowflakes } from './message.js';

const message = {
  id: '1234567890123456789',
  channelId: '123456789012345678',
  authorId: '223456789012345678',
  authorName: 'alice',
  authorAvatarUrl: null,
  content: 'hello',
  attachments: [],
  createdAt: '2026-11-06T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
};

describe('chatMessageSchema', () => {
  it('accepts a valid message', () => {
    expect(chatMessageSchema.parse(message)).toEqual(message);
  });

  it('rejects a non-snowflake id', () => {
    expect(chatMessageSchema.safeParse({ ...message, id: 'abc' }).success).toBe(false);
  });
});

describe('compareSnowflakes', () => {
  it('compares numerically, not lexicographically', () => {
    // "99..." > "100..." as strings, but not as numbers.
    expect(compareSnowflakes('99999999999999999', '100000000000000000')).toBe(-1);
    expect(compareSnowflakes('100000000000000000', '99999999999999999')).toBe(1);
    expect(compareSnowflakes('123456789012345678', '123456789012345678')).toBe(0);
  });
});
