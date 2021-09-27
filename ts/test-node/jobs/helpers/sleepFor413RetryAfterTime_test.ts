// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { HTTPError } from '../../../textsecure/Errors';
import * as durations from '../../../util/durations';

import { sleepFor413RetryAfterTime } from '../../../jobs/helpers/sleepFor413RetryAfterTime';

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

  it('does nothing if no time remains', async () => {
    const log = createLogger();

    await Promise.all(
      [-1, 0].map(timeRemaining =>
        sleepFor413RetryAfterTime({
          err: {},
          log,
          timeRemaining,
        })
      )
    );

    sinon.assert.notCalled(log.info);
  });

  it('waits for 1 second if the error lacks Retry-After info', async () => {
    let done = false;

    (async () => {
      await sleepFor413RetryAfterTime({
        err: {},
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

  it('finds the Retry-After header on an HTTPError', async () => {
    const err = new HTTPError('Slow down', {
      code: 413,
      headers: { 'retry-after': '200' },
      response: {},
    });

    let done = false;

    (async () => {
      await sleepFor413RetryAfterTime({
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

  it('finds the Retry-After on an HTTPError nested under a wrapper error', async () => {
    const httpError = new HTTPError('Slow down', {
      code: 413,
      headers: { 'retry-after': '200' },
      response: {},
    });

    let done = false;

    (async () => {
      await sleepFor413RetryAfterTime({
        err: { httpError },
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
      await sleepFor413RetryAfterTime({
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

    sleepFor413RetryAfterTime({ err, log, timeRemaining: 9999999 });
    await clock.nextAsync();

    sinon.assert.calledOnce(log.info);
    sinon.assert.calledWith(log.info, sinon.match(/123000 millisecond\(s\)/));
  });
});
