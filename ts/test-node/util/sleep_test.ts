// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { useFakeTimers } from 'sinon';

import { sleep } from '../../util/sleep';

describe('sleep', () => {
  beforeEach(function beforeEach() {
    // This isn't a hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    this.clock = useFakeTimers();
  });

  afterEach(function afterEach() {
    this.clock.restore();
  });

  it('returns a promise that resolves after the specified number of milliseconds', async function test() {
    let isDone = false;

    (async () => {
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
