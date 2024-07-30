// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { normalizeGroupCallTimestamp } from '../../../util/ringrtc/normalizeGroupCallTimestamp';

describe('normalizeGroupCallTimestamp', () => {
  it('returns undefined if passed a string that cannot be parsed as a number', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(''));
    assert.isUndefined(normalizeGroupCallTimestamp('uhhh'));
  });

  it('returns undefined if passed 0', () => {
    assert.isUndefined(normalizeGroupCallTimestamp('0'));
  });

  it('parses strings as numbers', () => {
    assert.strictEqual(normalizeGroupCallTimestamp('1'), 1);
    assert.strictEqual(normalizeGroupCallTimestamp('123'), 123);
  });

  it('only parses the first 15 characters of a string', () => {
    assert.strictEqual(
      normalizeGroupCallTimestamp('12345678901234567890123456789'),
      123456789012345
    );
  });
});
