// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isMuted } from '../../util/isMuted';

describe('isMuted', () => {
  it('returns false if passed undefined', () => {
    assert.isFalse(isMuted(undefined));
  });

  it('returns false if passed a date in the past', () => {
    assert.isFalse(isMuted(0));
    assert.isFalse(isMuted(Date.now() - 123));
  });

  it('returns false if passed a date in the future', () => {
    assert.isTrue(isMuted(Date.now() + 123));
    assert.isTrue(isMuted(Date.now() + 123456));
  });
});
