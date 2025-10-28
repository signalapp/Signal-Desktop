// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { Job } from '../../jobs/Job.std.js';

describe('Job', () => {
  it('stores its arguments', () => {
    const id = 'abc123';
    const timestamp = Date.now();
    const queueType = 'test queue';
    const data = { foo: 'bar' };
    const completion = Promise.resolve();

    const job = new Job(id, timestamp, queueType, data, completion);

    assert.strictEqual(job.id, id);
    assert.strictEqual(job.timestamp, timestamp);
    assert.strictEqual(job.queueType, queueType);
    assert.strictEqual(job.data, data);
    assert.strictEqual(job.completion, completion);
  });
});
