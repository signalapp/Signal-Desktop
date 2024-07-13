// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { useFakeTimers } from 'sinon';

import { sleep } from '../../util/sleep';

describe('sleep', () => {
  beforeEach(function (this: Mocha.Context) {
    // This isn't a hook.
    this.clock = useFakeTimers();
  });

  afterEach(function (this: Mocha.Context) {
    this.clock.restore();
  });

  it('returns a promise that resolves after the specified number of milliseconds', async function (this: Mocha.Context) {
    let isDone = false;

    void (async () => {
      await sleep(123);
      isDone = true;
    })();

    assert.isFalse(isDone);

    await this.clock.tickAsync(100);
    assert.isFalse(isDone);

    await this.clock.tickAsync(25);
    assert.isTrue(isDone);
  });
});
