import type { Attachment, ChatMessage } from '@app/shared';
import { memo } from 'react';

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
      <a href={attachment.url} target="_blank" rel="noreferrer noopener">
        <img className="message__image" src={attachment.url} alt={attachment.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="message__file" href={attachment.url} target="_blank" rel="noreferrer noopener">
      📎 {attachment.name} <span className="message__muted">({formatBytes(attachment.size)})</span>
    </a>
  );
}

export const MessageItem = memo(function MessageItem({ message }: { message: ChatMessage }) {
  const created = new Date(message.createdAt);
  return (
    <li className="message" data-message-id={message.id}>
      {message.authorAvatarUrl ? (
        <img
          className="message__avatar"
          src={message.authorAvatarUrl}
          alt=""
          width={40}
          height={40}
        />
      ) : (
        <span className="message__avatar message__avatar--fallback" aria-hidden="true">
          {message.authorName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="message__body">
        <div className="message__meta">
          <span className="message__author">{message.authorName}</span>
          <time
            className="message__muted"
            dateTime={message.createdAt}
            title={fullFormat.format(created)}
          >
            {timeFormat.format(created)}
          </time>
          {message.editedAt && !message.deletedAt && (
            <span className="message__muted">(edited)</span>
          )}
        </div>
        {message.deletedAt ? (
          <p className="message__content message__muted">
            <em>This message was deleted.</em>
          </p>
        ) : (
          <>
            {/* Rendered as plain text: React escapes it, so message content can never inject HTML. */}
            {message.content && <p className="message__content">{message.content}</p>}
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
