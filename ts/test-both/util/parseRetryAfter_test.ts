// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { parseRetryAfter } from '../../util/parseRetryAfter';

describe('parseRetryAfter', () => {
  it('should return 1 second when passed non-strings', () => {
    assert.equal(parseRetryAfter(undefined), 1000);
    assert.equal(parseRetryAfter(1234), 1000);
  });

  it('should return 1 second with invalid strings', () => {
    assert.equal(parseRetryAfter('nope'), 1000);
    assert.equal(parseRetryAfter('1ff'), 1000);
  });

  it('should return milliseconds on valid input', () => {
    assert.equal(parseRetryAfter('100'), 100000);
  });

  it('should return 1 second at minimum', () => {
    assert.equal(parseRetryAfter('0'), 1000);
    assert.equal(parseRetryAfter('-1'), 1000);
  });
});
