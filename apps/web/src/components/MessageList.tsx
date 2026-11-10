import type { ChatMessage } from '@app/shared';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildFeedRows } from './feed-rows';
import { MessageItem } from './MessageItem';

/** Within this many px of the bottom counts as "reading the latest", so we keep following. */
const STICK_THRESHOLD_PX = 80;

export interface MessageListProps {
  messages: ChatMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder(): void;
}

export function MessageList({ messages, hasOlder, loadingOlder, onLoadOlder }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const previous = useRef<{ firstId?: string; lastId?: string; scrollHeight: number }>({
    scrollHeight: 0,
  });
  const [unseen, setUnseen] = useState(0);
  const rows = useMemo(() => buildFeedRows(messages), [messages]);

  const firstId = messages[0]?.id;
  const lastId = messages[messages.length - 1]?.id;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = previous.current;

    if (prev.firstId !== undefined && firstId !== prev.firstId && lastId === prev.lastId) {
      // Older messages were prepended: keep the same messages under the reader's eyes.
      el.scrollTop += el.scrollHeight - prev.scrollHeight;
    } else if (lastId !== prev.lastId) {
      if (atBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      } else if (prev.lastId !== undefined) {
        setUnseen((n) => n + 1);
      }
    }
    previous.current = { firstId, lastId, scrollHeight: el.scrollHeight };
  }, [firstId, lastId, messages.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    if (atBottomRef.current) setUnseen(0);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setUnseen(0);
  };

  return (
    <div className="feed">
      <div className="feed__scroll" ref={scrollRef} onScroll={onScroll} data-testid="feed-scroll">
        <div className="feed__content">
          {hasOlder && (
            <button
              className="feed__older"
              type="button"
              onClick={onLoadOlder}
              disabled={loadingOlder}
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          )}
          {messages.length === 0 ? (
            <div className="feed__empty">
              <div className="feed__empty-icon" aria-hidden="true">
                #
              </div>
              <p className="feed__empty-title">No messages yet</p>
              <p className="feed__empty-text">
                Post something in the Discord channel and it will show up here instantly.
              </p>
            </div>
          ) : (
            <ol className="feed__list" aria-label="Messages">
              {rows.map(({ message, startsGroup, dayLabel }) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  startsGroup={startsGroup}
                  dayLabel={dayLabel}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
      {unseen > 0 && (
        <button className="feed__jump" type="button" onClick={jumpToLatest}>
          {unseen} new message{unseen === 1 ? '' : 's'} ↓
        </button>
      )}
    </div>
  );
}

function MessageRow({
  message,
  startsGroup,
  dayLabel,
}: {
  message: ChatMessage;
  startsGroup: boolean;
  dayLabel?: string;
}) {
  return (
    <>
      {dayLabel && (
        <li className="day-divider" role="separator" aria-label={dayLabel}>
          <span>{dayLabel}</span>
        </li>
      )}
      <MessageItem message={message} startsGroup={startsGroup} />
    </>
  );
}
