// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { JobError } from '../../jobs/JobError.std.js';

describe('JobError', () => {
  it('stores the provided argument as a property', () => {
    const fakeError = new Error('uh oh');
    const jobError1 = new JobError(fakeError);
    assert.strictEqual(jobError1.lastErrorThrownByJob, fakeError);

    const jobError2 = new JobError(123);
    assert.strictEqual(jobError2.lastErrorThrownByJob, 123);
  });

  it('if passed an Error, augments its `message`', () => {
    const fakeError = new Error('uh oh');
    const jobError = new JobError(fakeError);

    assert.strictEqual(jobError.message, 'Job failed. Last error: uh oh');
  });

  it('if passed a non-Error, stringifies it', () => {
    const jobError = new JobError({ foo: 'bar' });

    assert.strictEqual(
      jobError.message,
      'Job failed. Last error: {"foo":"bar"}'
    );
  });
});
