// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { normalizeDeviceName } from '../../util/normalizeDeviceName.std.js';

describe('normalizeDeviceName', () => {
  it('leaves normal device names untouched', () => {
    for (const name of ['foo', 'bar Baz', '💅💅💅']) {
      assert.strictEqual(normalizeDeviceName(name), name);
    }
  });

  it('trims device names', () => {
    assert.strictEqual(normalizeDeviceName(' foo\t'), 'foo');
  });

  it('removes null characters', () => {
    assert.strictEqual(normalizeDeviceName('\0foo\0bar'), 'foobar');
  });
});
