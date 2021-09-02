// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { HTTPError } from '../../../textsecure/Errors';
import * as durations from '../../../util/durations';

import { sleepFor413RetryAfterTimeIfApplicable } from '../../../jobs/helpers/sleepFor413RetryAfterTimeIfApplicable';

describe('sleepFor413RetryAfterTimeIfApplicable', () => {
  const createLogger = () => ({ info: sinon.spy() });

  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does nothing if not passed a 413 HTTP error', async () => {
    const log = createLogger();

    const errors = [
      undefined,
      new Error('Normal error'),
      new HTTPError('Uh oh', { code: 422, headers: {}, response: {} }),
    ];
    await Promise.all(
      errors.map(async err => {
        await sleepFor413RetryAfterTimeIfApplicable({
          err,
          log,
          timeRemaining: 1234,
        });
      })
    );

    sinon.assert.notCalled(log.info);
  });

  it('waits for 1 second if receiving a 413 HTTP error without a Retry-After header', async () => {
    const err = new HTTPError('Slow down', {
      code: 413,
      headers: {},
      response: {},
    });

    let done = false;

    (async () => {
      await sleepFor413RetryAfterTimeIfApplicable({
        err,
        log: createLogger(),
        timeRemaining: 1234,
      });
      done = true;
    })();

    await clock.tickAsync(999);
    assert.isFalse(done);

    await clock.tickAsync(2);
    assert.isTrue(done);
  });

  it('waits for Retry-After seconds if receiving a 413', async () => {
    const err = new HTTPError('Slow down', {
      code: 413,
      headers: { 'retry-after': '200' },
      response: {},
    });

    let done = false;

    (async () => {
      await sleepFor413RetryAfterTimeIfApplicable({
        err,
        log: createLogger(),
        timeRemaining: 123456789,
      });
      done = true;
    })();

    await clock.tickAsync(199 * durations.SECOND);
    assert.isFalse(done);

    await clock.tickAsync(2 * durations.SECOND);
    assert.isTrue(done);
  });

  it("won't wait longer than the remaining time", async () => {
    const err = new HTTPError('Slow down', {
      code: 413,
      headers: { 'retry-after': '99999' },
      response: {},
    });

    let done = false;

    (async () => {
      await sleepFor413RetryAfterTimeIfApplicable({
        err,
        log: createLogger(),
        timeRemaining: 3 * durations.SECOND,
      });
      done = true;
    })();

    await clock.tickAsync(4 * durations.SECOND);
    assert.isTrue(done);
  });

  it('logs how long it will wait', async () => {
    const log = createLogger();
    const err = new HTTPError('Slow down', {
      code: 413,
      headers: { 'retry-after': '123' },
      response: {},
    });

    sleepFor413RetryAfterTimeIfApplicable({ err, log, timeRemaining: 9999999 });
    await clock.nextAsync();

    sinon.assert.calledOnce(log.info);
    sinon.assert.calledWith(log.info, sinon.match(/123000 millisecond\(s\)/));
  });
});
