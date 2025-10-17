// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isValidE164 } from '../../util/isValidE164.std.js';

describe('isValidE164', () => {
  it('returns false for non-strings', () => {
    assert.isFalse(isValidE164(undefined, false));
    assert.isFalse(isValidE164(18885551234, false));
    assert.isFalse(isValidE164(['+18885551234'], false));
  });

  it('returns false for invalid E164s', () => {
    assert.isFalse(isValidE164('', false));
    assert.isFalse(isValidE164('+05551234', false));
    assert.isFalse(isValidE164('+1800ENCRYPT', false));
    assert.isFalse(isValidE164('+1-888-555-1234', false));
    assert.isFalse(isValidE164('+1 (888) 555-1234', false));
    assert.isFalse(isValidE164('+1012345678901234', false));
    assert.isFalse(isValidE164('+18885551234extra', false));
  });

  it('returns true for E164s that look valid', () => {
    assert.isTrue(isValidE164('+18885551234', false));
    assert.isTrue(isValidE164('+123456789012', false));
    assert.isTrue(isValidE164('+12', false));
  });

  it('can make the leading + optional or required', () => {
    assert.isTrue(isValidE164('18885551234', false));
    assert.isFalse(isValidE164('18885551234', true));
  });
});
