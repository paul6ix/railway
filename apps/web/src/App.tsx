import { useMessageStream } from './api/useMessageStream';
import { ConnectionStatus } from './components/ConnectionStatus';
import { MessageList } from './components/MessageList';

export function App() {
  const { messages, status, hasOlder, loadingOlder, loadOlder } = useMessageStream();
  return (
    <div className="shell">
      <main className="app">
        <header className="app__header">
          <div className="app__brand">
            <span className="app__mark" aria-hidden="true">
              #
            </span>
            <div>
              <h1 className="app__title">Discord Live Stream</h1>
              <p className="app__subtitle">Messages from the channel, as they&rsquo;re posted</p>
            </div>
          </div>
          <ConnectionStatus status={status} />
        </header>
        <MessageList
          messages={messages}
          hasOlder={hasOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={() => void loadOlder()}
        />
        <footer className="app__footer">
          Read-only mirror · {messages.length} message{messages.length === 1 ? '' : 's'} loaded
        </footer>
      </main>
    </div>
  );
}
