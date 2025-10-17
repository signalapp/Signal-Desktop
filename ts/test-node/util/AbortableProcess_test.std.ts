// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import lodash from 'lodash';

import { AbortableProcess } from '../../util/AbortableProcess.std.js';

const { noop } = lodash;

describe('AbortableProcess', () => {
  it('resolves the result normally', async () => {
    const process = new AbortableProcess(
      'process',
      { abort: noop },
      Promise.resolve(42)
    );

    assert.strictEqual(await process.getResult(), 42);
  });

  it('rejects normally', async () => {
    const process = new AbortableProcess(
      'process',
      { abort: noop },
      Promise.reject(new Error('rejected'))
    );

    await assert.isRejected(process.getResult(), 'rejected');
  });

  it('rejects on abort', async () => {
    let calledAbort = false;
    const process = new AbortableProcess(
      'A',
      {
        abort() {
          calledAbort = true;
        },
      },
      new Promise(noop)
    );

    process.abort();
    await assert.isRejected(process.getResult(), 'Process "A" was aborted');
    assert.isTrue(calledAbort);
  });
});
