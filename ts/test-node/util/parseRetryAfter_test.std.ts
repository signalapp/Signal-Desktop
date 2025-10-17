// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { MINUTE } from '../../util/durations/index.std.js';

import { parseRetryAfterWithDefault } from '../../util/parseRetryAfter.std.js';

describe('parseRetryAfter', () => {
  it('should return 1 minute when passed non-strings', () => {
    assert.equal(parseRetryAfterWithDefault(undefined), MINUTE);
    assert.equal(parseRetryAfterWithDefault(1234), MINUTE);
  });

  it('should return 1 minute with invalid strings', () => {
    assert.equal(parseRetryAfterWithDefault('nope'), MINUTE);
    assert.equal(parseRetryAfterWithDefault('1ff'), MINUTE);
  });

  it('should return milliseconds on valid input', () => {
    assert.equal(parseRetryAfterWithDefault('100'), 100000);
  });

  it('should return 1 second at minimum', () => {
    assert.equal(parseRetryAfterWithDefault('0'), 1000);
    assert.equal(parseRetryAfterWithDefault('-1'), 1000);
  });
});
