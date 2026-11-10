import type { Attachment, ChatMessage } from '@app/shared';
import { memo } from 'react';
import { authorHue } from './feed-rows';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentView({ attachment }: { attachment: Attachment }) {
  if (attachment.contentType?.startsWith('image/')) {
    return (
      <a
        className="message__image-link"
        href={attachment.url}
        target="_blank"
        rel="noreferrer noopener"
      >
        <img className="message__image" src={attachment.url} alt={attachment.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="message__file" href={attachment.url} target="_blank" rel="noreferrer noopener">
      <svg className="message__file-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span className="message__file-text">
        <span className="message__file-name">{attachment.name}</span>
        <span className="message__muted">({formatBytes(attachment.size)})</span>
      </span>
    </a>
  );
}

function Avatar({ message }: { message: ChatMessage }) {
  if (message.authorAvatarUrl) {
    return (
      <img
        className="message__avatar"
        src={message.authorAvatarUrl}
        alt=""
        width={40}
        height={40}
      />
    );
  }
  return (
    <span
      className="message__avatar message__avatar--fallback"
      style={{ ['--hue' as string]: authorHue(message.authorId) }}
      aria-hidden="true"
    >
      {message.authorName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export interface MessageItemProps {
  message: ChatMessage;
  /** First message of an author run: shows the avatar and name. */
  startsGroup?: boolean;
}

export const MessageItem = memo(function MessageItem({
  message,
  startsGroup = true,
}: MessageItemProps) {
  const created = new Date(message.createdAt);
  const time = (
    <time
      className={startsGroup ? 'message__time' : 'message__gutter-time'}
      dateTime={message.createdAt}
      title={fullFormat.format(created)}
    >
      {timeFormat.format(created)}
    </time>
  );

  return (
    <li
      className={`message ${startsGroup ? 'message--group-start' : 'message--continued'}`}
      data-message-id={message.id}
    >
      <div className="message__gutter">{startsGroup ? <Avatar message={message} /> : time}</div>
      <div className="message__body">
        {startsGroup && (
          <div className="message__meta">
            <span className="message__author">{message.authorName}</span>
            {time}
          </div>
        )}
        {message.deletedAt ? (
          <p className="message__content message__content--deleted">
            <em>This message was deleted.</em>
          </p>
        ) : (
          <>
            {/* Rendered as plain text: React escapes it, so message content can never inject HTML. */}
            {message.content && (
              <p className="message__content">
                {message.content}
                {message.editedAt && <span className="message__edited"> (edited)</span>}
              </p>
            )}
            {!message.content && message.editedAt && (
              <span className="message__edited">(edited)</span>
            )}
            {message.attachments.length > 0 && (
              <div className="message__attachments">
                {message.attachments.map((a) => (
                  <AttachmentView key={a.id} attachment={a} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
});
