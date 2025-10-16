// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { waitForAll } from '../../util/waitForAll.std.js';

describe('util/waitForAll', () => {
  it('returns result of provided tasks', async () => {
    const task1 = () => Promise.resolve(1);
    const task2 = () => Promise.resolve(2);
    const task3 = () => Promise.resolve(3);

    const result = await waitForAll({
      tasks: [task1, task2, task3],
      maxConcurrency: 1,
    });

    assert.deepEqual(result, [1, 2, 3]);
  });
});
