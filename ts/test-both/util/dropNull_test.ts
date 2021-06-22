// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { dropNull } from '../../util/dropNull';

describe('dropNull', () => {
  it('swaps null with undefined', () => {
    assert.strictEqual(dropNull(null), undefined);
  });

  it('leaves undefined be', () => {
    assert.strictEqual(dropNull(undefined), undefined);
  });

  it('non-null values undefined be', () => {
    assert.strictEqual(dropNull('test'), 'test');
  });
});
