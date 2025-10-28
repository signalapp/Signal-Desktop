// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { BackOff } from '../../util/BackOff.std.js';

describe('BackOff', () => {
  it('should return increasing timeouts', () => {
    const b = new BackOff([1, 2, 3]);

    assert.strictEqual(b.getIndex(), 0);
    assert.strictEqual(b.isFull(), false);

    assert.strictEqual(b.get(), 1);
    assert.strictEqual(b.getAndIncrement(), 1);
    assert.strictEqual(b.get(), 2);
    assert.strictEqual(b.getIndex(), 1);
    assert.strictEqual(b.isFull(), false);

    assert.strictEqual(b.getAndIncrement(), 2);
    assert.strictEqual(b.getIndex(), 2);
    assert.strictEqual(b.isFull(), true);

    assert.strictEqual(b.getAndIncrement(), 3);
    assert.strictEqual(b.getIndex(), 2);
    assert.strictEqual(b.isFull(), true);

    assert.strictEqual(b.getAndIncrement(), 3);
    assert.strictEqual(b.getIndex(), 2);
    assert.strictEqual(b.isFull(), true);
  });

  it('should reset', () => {
    const b = new BackOff([1, 2, 3]);

    assert.strictEqual(b.getAndIncrement(), 1);
    assert.strictEqual(b.getAndIncrement(), 2);

    b.reset();

    assert.strictEqual(b.getAndIncrement(), 1);
    assert.strictEqual(b.getAndIncrement(), 2);
  });

  it('should apply jitter', () => {
    const b = new BackOff([1, 2, 3], {
      jitter: 1,
      random: () => 0.5,
    });

    assert.strictEqual(b.getIndex(), 0);
    assert.strictEqual(b.isFull(), false);

    assert.strictEqual(b.get(), 1);
    assert.strictEqual(b.getAndIncrement(), 1);
    assert.strictEqual(b.get(), 2.5);
    assert.strictEqual(b.getIndex(), 1);
    assert.strictEqual(b.isFull(), false);

    assert.strictEqual(b.getAndIncrement(), 2.5);
    assert.strictEqual(b.getIndex(), 2);
    assert.strictEqual(b.isFull(), true);

    assert.strictEqual(b.getAndIncrement(), 3.5);
    assert.strictEqual(b.getIndex(), 2);
    assert.strictEqual(b.isFull(), true);

    assert.strictEqual(b.getAndIncrement(), 3.5);
    assert.strictEqual(b.getIndex(), 2);
    assert.strictEqual(b.isFull(), true);
  });
});
