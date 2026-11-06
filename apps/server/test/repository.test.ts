import type { ChatMessage } from '@app/shared';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/db.js';
import { createPrismaMessageRepo, type MessageRepo } from '../src/messages/repository.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const CHANNEL = '100000000000000001';
const OTHER_CHANNEL = '100000000000000002';

function makeMessage(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    channelId: CHANNEL,
    authorId: '200000000000000001',
    authorName: 'alice',
    authorAvatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
    content: `message ${id}`,
    attachments: [],
    createdAt: '2026-11-06T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

// Snowflakes of different lengths, so lexicographic ordering would be wrong.
const ids = ['99999999999999990', '99999999999999999', '100000000000000000', '100000000000000005'];

describe.skipIf(!testDatabaseUrl)('PrismaMessageRepo (integration)', () => {
  let prisma: PrismaClient;
  let repo: MessageRepo;

  beforeAll(() => {
    prisma = createPrismaClient(testDatabaseUrl!);
    repo = createPrismaMessageRepo(prisma);
  });

  beforeEach(async () => {
    await prisma.message.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('round-trips a message including attachments', async () => {
    const message = makeMessage(ids[0]!, {
      attachments: [
        {
          id: '300000000000000001',
          name: 'cat.png',
          url: 'https://cdn.discordapp.com/attachments/x/cat.png',
          contentType: 'image/png',
          size: 1234,
        },
      ],
    });
    await repo.upsert(message);
    expect(await repo.listRecent({ channelId: CHANNEL, limit: 10 })).toEqual([message]);
  });

  it('upsert is idempotent and applies edits without duplicating', async () => {
    const message = makeMessage(ids[0]!);
    await repo.upsert(message);
    await repo.upsert(message);
    const edited = { ...message, content: 'edited', editedAt: '2026-11-06T10:05:00.000Z' };
    await repo.upsert(edited);

    const result = await repo.listRecent({ channelId: CHANNEL, limit: 10 });
    expect(result).toEqual([edited]);
  });

  it('listRecent returns the newest N, oldest first, in numeric snowflake order', async () => {
    for (const id of [...ids].reverse()) await repo.upsert(makeMessage(id));

    const result = await repo.listRecent({ channelId: CHANNEL, limit: 3 });
    expect(result.map((m) => m.id)).toEqual(ids.slice(1));
  });

  it('listRecent with before pages to older messages', async () => {
    for (const id of ids) await repo.upsert(makeMessage(id));

    const result = await repo.listRecent({ channelId: CHANNEL, limit: 10, before: ids[2] });
    expect(result.map((m) => m.id)).toEqual(ids.slice(0, 2));
  });

  it('listAfter returns only newer messages, oldest first, capped by limit', async () => {
    for (const id of ids) await repo.upsert(makeMessage(id));

    expect(
      (await repo.listAfter({ channelId: CHANNEL, after: ids[1]!, limit: 10 })).map((m) => m.id),
    ).toEqual(ids.slice(2));
    expect(
      (await repo.listAfter({ channelId: CHANNEL, after: ids[0]!, limit: 1 })).map((m) => m.id),
    ).toEqual([ids[1]]);
  });

  it('scopes every query to the channel', async () => {
    await repo.upsert(makeMessage(ids[0]!));
    await repo.upsert(makeMessage(ids[1]!, { channelId: OTHER_CHANNEL }));

    expect((await repo.listRecent({ channelId: CHANNEL, limit: 10 })).map((m) => m.id)).toEqual([
      ids[0],
    ]);
    expect(await repo.listAfter({ channelId: CHANNEL, after: ids[0]!, limit: 10 })).toEqual([]);
  });
});
