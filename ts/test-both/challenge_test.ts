// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import { noop } from 'lodash';
import * as sinon from 'sinon';

import { STORAGE_KEY, ChallengeHandler } from '../challenge';
import type { RegisteredChallengeType } from '../challenge';
import { DAY, SECOND } from '../util/durations';

type CreateHandlerOptions = {
  readonly autoSolve?: boolean;
  readonly challengeError?: Error;
  readonly expireAfter?: number;
  readonly onChallengeSolved?: () => void;
  readonly onChallengeFailed?: (retryAt?: number) => void;
};

const NOW = Date.now();
const NEVER_RETRY = NOW + DAY;
const IMMEDIATE_RETRY = NOW - DAY;

// Various timeouts in milliseconds
const DEFAULT_RETRY_AFTER = 25;
const SOLVE_AFTER = 5;

describe('ChallengeHandler', () => {
  const storage = new Map<string, any>();
  let challengeStatus = 'idle';
  let queuesStarted: Array<string> = [];

  beforeEach(function (this: Mocha.Context) {
    storage.clear();
    challengeStatus = 'idle';
    queuesStarted = [];

    this.sandbox = sinon.createSandbox();
    this.clock = this.sandbox.useFakeTimers({
      now: NOW,
    });
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();
  });

  const createChallenge = (
    conversationId: string,
    options: Partial<RegisteredChallengeType> = {}
  ): RegisteredChallengeType => {
    return {
      conversationId,
      token: '1',
      retryAt: NOW + DEFAULT_RETRY_AFTER,
      createdAt: NOW - SECOND,
      reason: 'test',
      silent: false,
      ...options,
    };
  };

  const createHandler = async ({
    autoSolve = false,
    challengeError,
    expireAfter,
    onChallengeSolved = noop,
    onChallengeFailed = noop,
  }: CreateHandlerOptions = {}): Promise<ChallengeHandler> => {
    const handler = new ChallengeHandler({
      expireAfter,

      storage: {
        get(key: string) {
          return storage.get(key);
        },
        async put(key: string, value: unknown) {
          storage.set(key, value);
        },
      },

      startQueue(conversationId: string) {
        queuesStarted.push(conversationId);
      },

      onChallengeSolved,
      onChallengeFailed,

      requestChallenge(request) {
        if (!autoSolve) {
          return;
        }

        setTimeout(() => {
          handler.onResponse({
            seq: request.seq,
            data: { captcha: 'captcha' },
          });
        }, SOLVE_AFTER);
      },

      async sendChallengeResponse() {
        if (challengeError) {
          throw challengeError;
        }
      },

      setChallengeStatus(status) {
        challengeStatus = status;
      },
    });
    await handler.load();
    await handler.onOnline();
    return handler;
  };

  const isInStorage = (conversationId: string) => {
    return (storage.get(STORAGE_KEY) || []).some(
      ({ conversationId: storageId }: { conversationId: string }) => {
        return storageId === conversationId;
      }
    );
  };

  it('should automatically start queue after timeout', async function (this: Mocha.Context) {
    const handler = await createHandler();

    const one = createChallenge('1');
    await handler.register(one);
    assert.isTrue(isInStorage(one.conversationId));
    assert.equal(challengeStatus, 'required');

    await this.clock.nextAsync();

    assert.deepEqual(queuesStarted, [one.conversationId]);
    assert.equal(challengeStatus, 'idle');
    assert.isFalse(isInStorage(one.conversationId));
  });

  it('should send challenge response', async function (this: Mocha.Context) {
    const handler = await createHandler({ autoSolve: true });

    const one = createChallenge('1', {
      retryAt: NEVER_RETRY,
    });
    await handler.register(one);
    assert.equal(challengeStatus, 'required');

    await this.clock.nextAsync();

    assert.deepEqual(queuesStarted, [one.conversationId]);
    assert.isFalse(isInStorage(one.conversationId));
    assert.equal(challengeStatus, 'idle');
  });

  it('should send old challenges', async function (this: Mocha.Context) {
    const handler = await createHandler();

    const challenges = [
      createChallenge('1'),
      createChallenge('2'),
      createChallenge('3'),
    ];
    for (const challenge of challenges) {
      await handler.register(challenge);
    }

    assert.equal(challengeStatus, 'required');
    assert.deepEqual(queuesStarted, []);

    for (const challenge of challenges) {
      assert.isTrue(
        isInStorage(challenge.conversationId),
        `${challenge.conversationId} should be in storage`
      );
    }

    await handler.onOffline();

    // Wait for challenges to mature
    await this.clock.nextAsync();

    // Create new handler to load old challenges from storage; it will start up online
    await createHandler();

    for (const challenge of challenges) {
      await handler.unregister(challenge.conversationId, 'test');
    }

    for (const challenge of challenges) {
      assert.isFalse(
        isInStorage(challenge.conversationId),
        `${challenge.conversationId} should not be in storage`
      );
    }

    // The order has to be correct
    assert.deepEqual(queuesStarted, ['1', '2', '3']);
    assert.equal(challengeStatus, 'idle');
  });

  it('should send challenge immediately if it is ready', async () => {
    const handler = await createHandler();

    const one = createChallenge('1', {
      retryAt: IMMEDIATE_RETRY,
    });
    await handler.register(one);

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(queuesStarted, [one.conversationId]);
  });

  it('should not retry expired challenges', async function (this: Mocha.Context) {
    const handler = await createHandler();

    const one = createChallenge('1');
    await handler.register(one);
    assert.isTrue(isInStorage(one.conversationId));

    const newHandler = await createHandler({
      autoSolve: true,
      expireAfter: -1,
    });
    await handler.unregister(one.conversationId, 'test');

    challengeStatus = 'idle';
    await newHandler.load();

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(queuesStarted, []);

    await this.clock.nextAsync();

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(queuesStarted, []);
    assert.isFalse(isInStorage(one.conversationId));
  });

  it('should send challenges that matured while we were offline', async function (this: Mocha.Context) {
    const handler = await createHandler();

    const one = createChallenge('1');
    await handler.register(one);

    assert.isTrue(isInStorage(one.conversationId));
    assert.deepEqual(queuesStarted, []);
    assert.equal(challengeStatus, 'required');

    await handler.onOffline();

    // Let challenges mature
    await this.clock.nextAsync();

    assert.isTrue(isInStorage(one.conversationId));
    assert.deepEqual(queuesStarted, []);
    assert.equal(challengeStatus, 'required');

    // Go back online
    await handler.onOnline();

    // startQueue awaits this.unregister() before calling options.startQueue
    await this.clock.nextAsync();

    assert.isFalse(isInStorage(one.conversationId));
    assert.deepEqual(queuesStarted, [one.conversationId]);
    assert.equal(challengeStatus, 'idle');
  });

  it('should trigger onChallengeSolved', async function (this: Mocha.Context) {
    const onChallengeSolved = sinon.stub();

    const handler = await createHandler({
      autoSolve: true,
      onChallengeSolved,
    });

    const one = createChallenge('1', {
      retryAt: NEVER_RETRY,
    });
    await handler.register(one);

    // Let the challenge go through
    await this.clock.nextAsync();

    sinon.assert.calledOnce(onChallengeSolved);
  });

  it('should trigger onChallengeFailed', async function (this: Mocha.Context) {
    const onChallengeFailed = sinon.stub();

    const handler = await createHandler({
      autoSolve: true,
      challengeError: new Error('custom failure'),
      onChallengeFailed,
    });

    const one = createChallenge('1', {
      retryAt: NEVER_RETRY,
    });
    await handler.register(one);

    // Let the challenge go through
    await this.clock.nextAsync();

    sinon.assert.calledOnce(onChallengeFailed);
  });
});
