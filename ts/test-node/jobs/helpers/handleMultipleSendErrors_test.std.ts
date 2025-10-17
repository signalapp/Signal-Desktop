// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import lodash from 'lodash';
import { SendMessageProtoError } from '../../../textsecure/Errors.std.js';
import { HTTPError } from '../../../types/HTTPError.std.js';
import { SECOND } from '../../../util/durations/index.std.js';

import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from '../../../jobs/helpers/handleMultipleSendErrors.std.js';

const { noop, omit } = lodash;

describe('maybeExpandErrors', () => {
  // This returns a readonly array, but Chai wants a mutable one.
  const expand = (input: unknown) => maybeExpandErrors(input) as Array<unknown>;

  it("wraps the provided value if it's not a SendMessageProtoError with errors", () => {
    const input = { foo: 123 };
    assert.sameMembers(expand(input), [input]);
  });

  it('wraps the provided value if a SendMessageProtoError with no errors', () => {
    const input = new SendMessageProtoError({
      dataMessage: undefined,
      editMessage: undefined,
    });
    assert.sameMembers(expand(input), [input]);
  });

  it("uses a SendMessageProtoError's errors", () => {
    const errors = [new Error('one'), new Error('two')];
    const input = new SendMessageProtoError({
      dataMessage: undefined,
      editMessage: undefined,
      errors,
    });
    assert.strictEqual(expand(input), errors);
  });
});

describe('handleMultipleSendErrors', () => {
  const makeSlowDown = (code: 413 | 429, retryAfter: number): HTTPError =>
    new HTTPError('Slow down', {
      code,
      headers: { 'retry-after': retryAfter.toString() },
      response: {},
    });

  const defaultOptions = {
    isFinalAttempt: false,
    log: { info: noop },
    markFailed: () => {
      throw new Error('This should not be called');
    },
    timeRemaining: 1234,
  };

  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('throws the first provided error', async () => {
    await assert.isRejected(
      handleMultipleSendErrors({
        ...defaultOptions,
        errors: [new Error('first'), new Error('second')],
        toThrow: new Error('to throw'),
      }),
      'to throw'
    );
  });

  it("marks the send failed if it's the final attempt", async () => {
    const markFailed = sinon.stub();

    await assert.isRejected(
      handleMultipleSendErrors({
        ...defaultOptions,
        errors: [new Error('uh oh')],
        markFailed,
        isFinalAttempt: true,
        toThrow: new Error('to throw'),
      })
    );

    sinon.assert.calledOnceWithExactly(markFailed);
  });

  it("doesn't require `markFailed`", async () => {
    await assert.isRejected(
      handleMultipleSendErrors({
        ...omit(defaultOptions, 'markFailed'),
        errors: [new Error('Test message')],
        isFinalAttempt: true,
        toThrow: new Error('to throw'),
      }),
      'to throw'
    );
  });

  for (const code of [413, 429] as const) {
    // eslint-disable-next-line no-loop-func
    describe(`${code} handling`, () => {
      it(`sleeps for the longest ${code} Retry-After time`, async () => {
        let done = false;

        void (async () => {
          try {
            await handleMultipleSendErrors({
              ...defaultOptions,
              errors: [
                new Error('Other'),
                makeSlowDown(code, 10),
                makeSlowDown(code, 999),
                makeSlowDown(code, 20),
              ],
              timeRemaining: 99999999,
              toThrow: new Error('to throw'),
            });
          } catch (err) {
            // No-op
          } finally {
            done = true;
          }
        })();

        await clock.tickAsync(900 * SECOND);
        assert.isFalse(done, "Didn't sleep for long enough");
        await clock.tickAsync(100 * SECOND);
        assert.isTrue(done, 'Slept for too long');
      });

      it("doesn't sleep longer than the remaining time", async () => {
        let done = false;

        void (async () => {
          try {
            await handleMultipleSendErrors({
              ...defaultOptions,
              errors: [makeSlowDown(code, 9999)],
              timeRemaining: 99,
              toThrow: new Error('to throw'),
            });
          } catch (err) {
            // No-op
          } finally {
            done = true;
          }
        })();

        await clock.tickAsync(100);
        assert.isTrue(done);
      });

      it("doesn't sleep if it's the final attempt", async () => {
        await assert.isRejected(
          handleMultipleSendErrors({
            ...defaultOptions,
            errors: [new Error('uh oh')],
            isFinalAttempt: true,
            toThrow: new Error('to throw'),
          })
        );
      });
    });
  }

  describe('508 handling', () => {
    it('resolves with no error if any 508 is received', async () => {
      await assert.isFulfilled(
        handleMultipleSendErrors({
          ...defaultOptions,
          errors: [
            new Error('uh oh'),
            { code: 508 },
            makeSlowDown(413, 99999),
            makeSlowDown(429, 99999),
          ],
          markFailed: noop,
          toThrow: new Error('to throw'),
        })
      );
    });

    it('marks the send failed on a 508', async () => {
      const markFailed = sinon.stub();

      await handleMultipleSendErrors({
        ...defaultOptions,
        errors: [{ code: 508 }],
        markFailed,
        toThrow: new Error('to throw'),
      });

      sinon.assert.calledOnceWithExactly(markFailed);
    });
  });
});
