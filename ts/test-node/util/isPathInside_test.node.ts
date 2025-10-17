// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isPathInside } from '../../util/isPathInside.node.js';

describe('isPathInside', () => {
  it('returns false if the child path is not inside the parent path', () => {
    assert.isFalse(isPathInside('x', 'a/b'));
    assert.isFalse(isPathInside('a/b', '/a/b'));
    assert.isFalse(isPathInside('/a/b', 'a/b'));
    assert.isFalse(isPathInside('/x', '/a/b'));
    assert.isFalse(isPathInside('/x/y', '/a/b'));
    assert.isFalse(isPathInside('/a/x', '/a/b'));
    assert.isFalse(isPathInside('/a/bad', '/a/b'));
    assert.isFalse(isPathInside('/a/x', '/a/b'));
    assert.isFalse(isPathInside('/a/b', '/a/b'));
    assert.isFalse(isPathInside('/a/b/c/..', '/a/b'));
    assert.isFalse(isPathInside('/', '/'));
    assert.isFalse(isPathInside('/x/..', '/'));

    if (process.platform === 'win32') {
      assert.isFalse(isPathInside('C:\\a\\x\\y', 'C:\\a\\b'));
      assert.isFalse(isPathInside('D:\\a\\b\\c', 'C:\\a\\b'));
    }
  });

  it('returns true if the child path is inside the parent path', () => {
    assert.isTrue(isPathInside('a/b/c', 'a/b'));
    assert.isTrue(isPathInside('a/b/c/d', 'a/b'));
    assert.isTrue(isPathInside('/a/b/c', '/a/b'));
    assert.isTrue(isPathInside('/a/b/c', '/a/b/'));
    assert.isTrue(isPathInside('/a/b/c/', '/a/b'));
    assert.isTrue(isPathInside('/a/b/c/', '/a/b/'));
    assert.isTrue(isPathInside('/a/b/c/d', '/a/b'));
    assert.isTrue(isPathInside('/a/b/c/d/..', '/a/b'));
    assert.isTrue(isPathInside('/x/y/z/z/y', '/'));
    assert.isTrue(isPathInside('x/y/z/z/y', '/'));

    if (process.platform === 'win32') {
      assert.isTrue(isPathInside('C:\\a\\b\\c', 'C:\\a\\b'));
    }
  });
});
