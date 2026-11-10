import { render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { FakeEventSource, jsonResponse } from './helpers';

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse([])),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('renders the header and connection status', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Discord Live Stream' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…');
    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });
});
