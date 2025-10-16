// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isNotNil } from '../../util/isNotNil.std.js';

describe('isNotNil', () => {
  it('returns false if provided null value', () => {
    assert.isFalse(isNotNil(null));
  });

  it('returns false is provided undefined value', () => {
    assert.isFalse(isNotNil(undefined));
  });

  it('returns false is provided any other value', () => {
    assert.isTrue(isNotNil(0));
    assert.isTrue(isNotNil(4));
    assert.isTrue(isNotNil(''));
    assert.isTrue(isNotNil('string value'));
    assert.isTrue(isNotNil({}));
  });
});
