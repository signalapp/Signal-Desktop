// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { EventEmitter } from 'node:events';

import { wrapEventEmitterOnce as once } from '../../util/wrapEventEmitterOnce.node.js';

describe('wrapEventEmitterOnce', () => {
  let ee: EventEmitter;

  beforeEach(() => {
    ee = new EventEmitter();
  });

  it('should get the event arguments', async () => {
    const result = once(ee, 'result');

    ee.emit('result', 1, 2, 3);

    assert.deepStrictEqual(await result, [1, 2, 3]);
  });

  it('should handle error event', async () => {
    const result = once(ee, 'result');

    ee.emit('error', new Error('aha!'));

    await assert.isRejected(result, 'aha!');
  });

  it('should stop handling error event after result', async () => {
    const result = once(ee, 'result');

    ee.emit('result', 'okay');

    assert.deepStrictEqual(await result, ['okay']);
    assert.strictEqual(ee.listeners('error').length, 0);
  });
});
