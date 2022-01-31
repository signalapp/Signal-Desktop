// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { MINUTE } from '../../util/durations';

import { parseRetryAfter } from '../../util/parseRetryAfter';

describe('parseRetryAfter', () => {
  it('should return 1 minute when passed non-strings', () => {
    assert.equal(parseRetryAfter(undefined), MINUTE);
    assert.equal(parseRetryAfter(1234), MINUTE);
  });

  it('should return 1 minute with invalid strings', () => {
    assert.equal(parseRetryAfter('nope'), MINUTE);
    assert.equal(parseRetryAfter('1ff'), MINUTE);
  });

  it('should return milliseconds on valid input', () => {
    assert.equal(parseRetryAfter('100'), 100000);
  });

  it('should return 1 second at minimum', () => {
    assert.equal(parseRetryAfter('0'), 1000);
    assert.equal(parseRetryAfter('-1'), 1000);
  });
});
