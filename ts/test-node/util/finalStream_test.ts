// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { finalStream } from '../../util/finalStream';

describe('finalStream', () => {
  it('should invoke callback before pipeline resolves', async () => {
    let called = false;
    await pipeline(
      Readable.from(['abc']),
      finalStream(async () => {
        // Forcing next tick
        await Promise.resolve();

        called = true;
      })
    );

    assert.isTrue(called);
  });

  it('should propagate errors from callback', async () => {
    await assert.isRejected(
      pipeline(
        Readable.from(['abc']),
        finalStream(async () => {
          // Forcing next tick
          await Promise.resolve();

          throw new Error('failure');
        })
      ),
      'failure'
    );
  });
});
