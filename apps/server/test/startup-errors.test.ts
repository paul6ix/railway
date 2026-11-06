import { describe, expect, it } from 'vitest';
import { EnvError } from '../src/env.js';
import { describeStartupError } from '../src/startup-errors.js';

describe('describeStartupError', () => {
  it('passes env errors through', () => {
    expect(describeStartupError(new EnvError('bad env'))).toBe('bad env');
  });

  it('explains an invalid Discord token', () => {
    expect(describeStartupError(Object.assign(new Error('x'), { code: 'TokenInvalid' }))).toMatch(
      /DISCORD_TOKEN/,
    );
  });

  it.each(['DisallowedIntents', 4014])('explains a missing privileged intent (%s)', (code) => {
    expect(describeStartupError(Object.assign(new Error('x'), { code }))).toMatch(
      /Message Content Intent/,
    );
  });

  it('returns null for unexpected errors', () => {
    expect(describeStartupError(new Error('boom'))).toBeNull();
    expect(describeStartupError(undefined)).toBeNull();
  });
});
