import type { ConnectionStatus as Status } from '../api/messages-state';

const LABELS: Record<Status, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  error: 'Offline, retrying…',
};

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <span className={`status status--${status}`} role="status" aria-live="polite">
      <span className="status__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
