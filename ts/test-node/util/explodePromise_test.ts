// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { explodePromise } from '../../util/explodePromise.std.js';

describe('explodePromise', () => {
  it('resolves the promise', async () => {
    const { promise, resolve } = explodePromise<number>();

    resolve(42);

    assert.strictEqual(await promise, 42);
  });

  it('rejects the promise', async () => {
    const { promise, reject } = explodePromise<number>();

    reject(new Error('rejected'));

    await assert.isRejected(promise, 'rejected');
  });
});
