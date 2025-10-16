// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { areObjectEntriesEqual } from '../../util/areObjectEntriesEqual.std.js';

describe('areObjectEntriesEqual', () => {
  type TestObject = { foo?: number; bar?: number };

  const empty: TestObject = {};
  const foo: TestObject = { foo: 1 };
  const bar: TestObject = { bar: 2 };
  const undefinedEntries: TestObject = { foo: undefined, bar: undefined };

  it('returns true for an empty list of keys', () => {
    assert.isTrue(areObjectEntriesEqual({}, {}, []));
    assert.isTrue(areObjectEntriesEqual(foo, foo, []));
    assert.isTrue(areObjectEntriesEqual(foo, bar, []));
  });

  it('returns true for empty objects', () => {
    assert.isTrue(areObjectEntriesEqual(empty, empty, ['foo']));
  });

  it('considers missing keys equal to undefined keys', () => {
    assert.isTrue(
      areObjectEntriesEqual(empty, undefinedEntries, ['foo', 'bar'])
    );
  });

  it('ignores unspecified properties', () => {
    assert.isTrue(areObjectEntriesEqual({ x: 1, y: 2 }, { x: 1, y: 3 }, ['x']));
  });

  it('returns false for different objects', () => {
    assert.isFalse(areObjectEntriesEqual({ x: 1 }, { x: 2 }, ['x']));
    assert.isFalse(
      areObjectEntriesEqual({ x: 1, y: 2 }, { x: 1, y: 3 }, ['x', 'y'])
    );
  });

  it('only performs a shallow check', () => {
    assert.isFalse(areObjectEntriesEqual({ x: [1, 2] }, { x: [1, 2] }, ['x']));
  });
});
