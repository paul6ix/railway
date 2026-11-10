import {
  authorHue,
  buildFeedRows,
  formatDayLabel,
  GROUP_WINDOW_MS,
} from '../src/components/feed-rows';
import { ids, makeMessage } from './helpers';

const at = (iso: string) => new Date(iso).toISOString();

describe('buildFeedRows', () => {
  const now = new Date('2026-11-06T18:00:00');
  const [a, b, c, d, e] = ids(5);

  it('groups consecutive messages from the same author', () => {
    const rows = buildFeedRows(
      [
        makeMessage(a!, { createdAt: at('2026-11-06T10:00:00') }),
        makeMessage(b!, { createdAt: at('2026-11-06T10:01:00') }),
        makeMessage(c!, { createdAt: at('2026-11-06T10:02:00'), authorId: 'other' }),
      ],
      now,
    );
    expect(rows.map((r) => r.startsGroup)).toEqual([true, false, true]);
  });

  it('starts a new group after a long gap', () => {
    const start = new Date('2026-11-06T10:00:00').getTime();
    const rows = buildFeedRows(
      [
        makeMessage(a!, { createdAt: new Date(start).toISOString() }),
        makeMessage(b!, { createdAt: new Date(start + GROUP_WINDOW_MS + 1).toISOString() }),
      ],
      now,
    );
    expect(rows[1]!.startsGroup).toBe(true);
  });

  it('labels each new day and breaks groups across days', () => {
    const rows = buildFeedRows(
      [
        makeMessage(a!, { createdAt: at('2026-11-04T23:58:00') }),
        makeMessage(b!, { createdAt: at('2026-11-05T23:59:00') }),
        makeMessage(c!, { createdAt: at('2026-11-06T00:01:00') }),
        makeMessage(d!, { createdAt: at('2026-11-06T00:02:00') }),
        makeMessage(e!, { createdAt: at('2026-11-06T00:03:00') }),
      ],
      now,
    );
    expect(rows.map((r) => r.dayLabel)).toEqual([
      formatDayLabel(new Date('2026-11-04T12:00:00'), now),
      'Yesterday',
      'Today',
      undefined,
      undefined,
    ]);
    expect(rows[2]!.startsGroup).toBe(true);
  });
});

describe('authorHue', () => {
  it('is stable and within range', () => {
    expect(authorHue('123')).toBe(authorHue('123'));
    expect(authorHue('123')).toBeGreaterThanOrEqual(0);
    expect(authorHue('123')).toBeLessThan(360);
  });
});
