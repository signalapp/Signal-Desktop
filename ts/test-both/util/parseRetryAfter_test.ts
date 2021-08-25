// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { parseRetryAfter } from '../../util/parseRetryAfter';

describe('parseRetryAfter', () => {
  it('should return 0 on invalid input', () => {
    assert.equal(parseRetryAfter('nope'), 1000);
    assert.equal(parseRetryAfter('1ff'), 1000);
  });

  it('should return milleseconds on valid input', () => {
    assert.equal(parseRetryAfter('100'), 100000);
  });

  it('should return apply minimum value', () => {
    assert.equal(parseRetryAfter('0'), 1000);
    assert.equal(parseRetryAfter('-1'), 1000);
  });
});
