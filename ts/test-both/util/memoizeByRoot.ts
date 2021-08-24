// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { memoizeByRoot } from '../../util/memoizeByRoot';

class Root {}

describe('memoizeByRoot', () => {
  it('should memoize by last passed arguments', () => {
    const root = new Root();

    const stub = sinon.stub();
    stub.withArgs(sinon.match.same(root), 1).returns(1);
    stub.withArgs(sinon.match.same(root), 2).returns(2);

    const fn = memoizeByRoot(stub);

    assert.strictEqual(fn(root, 1), 1);
    assert.strictEqual(fn(root, 1), 1);
    assert.isTrue(stub.calledOnce);

    assert.strictEqual(fn(root, 2), 2);
    assert.strictEqual(fn(root, 2), 2);
    assert.isTrue(stub.calledTwice);

    assert.strictEqual(fn(root, 1), 1);
    assert.strictEqual(fn(root, 1), 1);
    assert.isTrue(stub.calledThrice);
  });

  it('should memoize results by root', () => {
    const rootA = new Root();
    const rootB = new Root();

    const stub = sinon.stub();
    stub.withArgs(sinon.match.same(rootA), 1).returns(1);
    stub.withArgs(sinon.match.same(rootA), 2).returns(2);
    stub.withArgs(sinon.match.same(rootB), 1).returns(3);
    stub.withArgs(sinon.match.same(rootB), 2).returns(4);

    const fn = memoizeByRoot(stub);

    assert.strictEqual(fn(rootA, 1), 1);
    assert.strictEqual(fn(rootB, 1), 3);
    assert.strictEqual(fn(rootA, 1), 1);
    assert.strictEqual(fn(rootB, 1), 3);
    assert.isTrue(stub.calledTwice);

    assert.strictEqual(fn(rootA, 2), 2);
    assert.strictEqual(fn(rootB, 2), 4);
    assert.strictEqual(fn(rootA, 2), 2);
    assert.strictEqual(fn(rootB, 2), 4);
    assert.strictEqual(stub.callCount, 4);

    assert.strictEqual(fn(rootA, 1), 1);
    assert.strictEqual(fn(rootB, 1), 3);
    assert.strictEqual(stub.callCount, 6);
  });
});
