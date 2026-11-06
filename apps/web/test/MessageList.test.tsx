import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList, type MessageListProps } from '../src/components/MessageList';
import { ids, makeMessage } from './helpers';

// jsdom has no layout; drive the scroll geometry by hand.
const geometry = { scrollHeight: 1000, clientHeight: 400 };
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => geometry.scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => geometry.clientHeight,
  });
});
beforeEach(() => {
  geometry.scrollHeight = 1000;
});

function renderList(props: Partial<MessageListProps> = {}) {
  const defaults: MessageListProps = {
    messages: [],
    hasOlder: false,
    loadingOlder: false,
    onLoadOlder: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  const utils = render(<MessageList {...merged} />);
  return {
    ...utils,
    scroller: screen.getByTestId('feed-scroll'),
    rerenderWith: (next: Partial<MessageListProps>) =>
      utils.rerender(<MessageList {...merged} {...next} />),
  };
}

describe('MessageList', () => {
  it('shows an empty state', () => {
    renderList();
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });

  it('renders content as text, never as HTML', () => {
    renderList({
      messages: [makeMessage(ids(1)[0]!, { content: '<img src=x onerror=alert(1)>' })],
    });
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('renders author, edited marker, deleted placeholder and attachments', () => {
    const [a, b, c] = ids(3);
    renderList({
      messages: [
        makeMessage(a!, { authorName: 'Bob', editedAt: '2026-11-06T10:01:00.000Z' }),
        makeMessage(b!, { deletedAt: '2026-11-06T10:02:00.000Z', content: '' }),
        makeMessage(c!, {
          attachments: [
            {
              id: '1',
              name: 'cat.png',
              url: 'https://cdn.example/cat.png',
              contentType: 'image/png',
              size: 10,
            },
            {
              id: '2',
              name: 'notes.pdf',
              url: 'https://cdn.example/n.pdf',
              contentType: 'application/pdf',
              size: 2048,
            },
          ],
        }),
      ],
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('(edited)')).toBeInTheDocument();
    expect(screen.getByText('This message was deleted.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'cat.png' })).toHaveAttribute(
      'src',
      'https://cdn.example/cat.png',
    );
    expect(screen.getByRole('link', { name: /notes\.pdf/ })).toHaveTextContent('2.0 KB');
  });

  it('calls onLoadOlder from the button and disables it while loading', async () => {
    const onLoadOlder = vi.fn();
    const { rerenderWith } = renderList({
      messages: [makeMessage(ids(1)[0]!)],
      hasOlder: true,
      onLoadOlder,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    expect(onLoadOlder).toHaveBeenCalledOnce();
    rerenderWith({ messages: [makeMessage(ids(1)[0]!)], hasOlder: true, loadingOlder: true });
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('follows new messages while the reader is at the bottom', () => {
    const [a, b] = ids(2);
    const { scroller, rerenderWith } = renderList({ messages: [makeMessage(a!)] });
    expect(scroller.scrollTop).toBe(1000);

    geometry.scrollHeight = 1100;
    rerenderWith({ messages: [makeMessage(a!), makeMessage(b!)] });
    expect(scroller.scrollTop).toBe(1100);
    expect(screen.queryByRole('button', { name: /new message/ })).toBeNull();
  });

  it('does not yank a reader who scrolled up, and offers a jump button instead', async () => {
    const [a, b, c] = ids(3);
    const { scroller, rerenderWith } = renderList({ messages: [makeMessage(a!)] });

    act(() => {
      scroller.scrollTop = 100;
      scroller.dispatchEvent(new Event('scroll'));
    });
    rerenderWith({ messages: [makeMessage(a!), makeMessage(b!)] });
    rerenderWith({ messages: [makeMessage(a!), makeMessage(b!), makeMessage(c!)] });
    expect(scroller.scrollTop).toBe(100);

    await userEvent.click(screen.getByRole('button', { name: '2 new messages ↓' }));
    expect(scroller.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: /new message/ })).toBeNull();
  });

  it('keeps the reading position when older messages are prepended', () => {
    const [older, a] = ids(2);
    const { scroller, rerenderWith } = renderList({ messages: [makeMessage(a!)], hasOlder: true });
    act(() => {
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event('scroll'));
    });
    geometry.scrollHeight = 1300;
    rerenderWith({ messages: [makeMessage(older!), makeMessage(a!)], hasOlder: false });
    expect(scroller.scrollTop).toBe(300);
  });
});
