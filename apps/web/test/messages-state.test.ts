import { initialMessagesState, mergeMessages, messagesReducer } from '../src/api/messages-state';
import { makeMessage } from './helpers';

describe('mergeMessages', () => {
  it('dedupes by id, lets incoming win, and sorts numerically by snowflake', () => {
    const a = makeMessage('99999999999999999');
    const b = makeMessage('100000000000000000');
    const bEdited = { ...b, content: 'edited' };
    expect(mergeMessages([b], [a, bEdited])).toEqual([a, bEdited]);
  });
});

describe('messagesReducer', () => {
  it('keeps messages that streamed in before history arrived', () => {
    const live = makeMessage('100000000000000005');
    let state = messagesReducer(initialMessagesState, { type: 'upsert', message: live });
    state = messagesReducer(state, {
      type: 'history',
      messages: [makeMessage('100000000000000001')],
      hasOlder: false,
    });
    expect(state.messages.map((m) => m.id)).toEqual(['100000000000000001', '100000000000000005']);
  });

  it('tracks loading of older pages', () => {
    let state = messagesReducer(initialMessagesState, { type: 'olderRequested' });
    expect(state.loadingOlder).toBe(true);
    state = messagesReducer(state, { type: 'olderFailed' });
    expect(state.loadingOlder).toBe(false);
  });

  it('returns the same object when status is unchanged', () => {
    expect(messagesReducer(initialMessagesState, { type: 'status', status: 'connecting' })).toBe(
      initialMessagesState,
    );
  });
});
