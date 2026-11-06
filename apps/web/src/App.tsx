import { useMessageStream } from './api/useMessageStream';
import { ConnectionStatus } from './components/ConnectionStatus';
import { MessageList } from './components/MessageList';

export function App() {
  const { messages, status, hasOlder, loadingOlder, loadOlder } = useMessageStream();
  return (
    <main className="app">
      <header className="app__header">
        <h1># Discord Live Stream</h1>
        <ConnectionStatus status={status} />
      </header>
      <MessageList
        messages={messages}
        hasOlder={hasOlder}
        loadingOlder={loadingOlder}
        onLoadOlder={() => void loadOlder()}
      />
    </main>
  );
}
