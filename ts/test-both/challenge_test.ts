// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import { noop } from 'lodash';
import * as sinon from 'sinon';

import type { MinimalMessage } from '../challenge';
import { ChallengeHandler } from '../challenge';

type CreateMessageOptions = {
  readonly sentAt?: number;
  readonly retryAfter?: number;
  readonly isNormalBubble?: boolean;
};

type CreateHandlerOptions = {
  readonly autoSolve?: boolean;
  readonly challengeError?: Error;
  readonly expireAfter?: number;
  readonly onChallengeSolved?: () => void;
  readonly onChallengeFailed?: (retryAfter?: number) => void;
};

const NOW = Date.now();
const ONE_DAY = 24 * 3600 * 1000;
const NEVER_RETRY = NOW + ONE_DAY;
const IMMEDIATE_RETRY = NOW - ONE_DAY;

// Various timeouts in milliseconds
const DEFAULT_RETRY_AFTER = 25;
const SOLVE_AFTER = 5;

describe('ChallengeHandler', () => {
  const storage = new Map<string, any>();
  const messageStorage = new Map<string, MinimalMessage>();
  let challengeStatus = 'idle';
  let sent: Array<string> = [];

  beforeEach(function beforeEach() {
    storage.clear();
    messageStorage.clear();
    challengeStatus = 'idle';
    sent = [];

    this.sandbox = sinon.createSandbox();
    this.clock = this.sandbox.useFakeTimers({
      now: NOW,
    });
  });

  afterEach(function afterEach() {
    this.sandbox.restore();
  });

  const createMessage = (
    id: string,
    options: CreateMessageOptions = {}
  ): MinimalMessage => {
    const {
      sentAt = 0,
      isNormalBubble = true,
      retryAfter = NOW + DEFAULT_RETRY_AFTER,
    } = options;

    const testLocalSent = sent;

    const events = new Map<string, () => void>();

    return {
      id,
      idForLogging: () => id,
      isNormalBubble() {
        return isNormalBubble;
      },
      getLastChallengeError() {
        return {
          name: 'Ignored',
          message: 'Ignored',
          retryAfter,
          data: { token: 'token', options: ['recaptcha'] },
        };
      },
      get(name) {
        assert.equal(name, 'sent_at');
        return sentAt;
      },
      on(name, handler) {
        if (events.get(name)) {
          throw new Error('Duplicate event');
        }
        events.set(name, handler);
      },
      off(name, handler) {
        assert.equal(events.get(name), handler);
        events.delete(name);
      },
      async retrySend() {
        const handler = events.get('sent');
        if (!handler) {
          throw new Error('Expected handler');
        }
        handler();
        testLocalSent.push(this.id);
      },
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

      async getMessageById(messageId) {
        return messageStorage.get(messageId);
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

  const isInStorage = (messageId: string) => {
    return (storage.get('challenge:retry-message-ids') || []).some(
      ({ messageId: storageId }: { messageId: string }) => {
        return storageId === messageId;
      }
    );
  };

  it('should automatically retry after timeout', async function test() {
    const handler = await createHandler();

    const one = createMessage('1');
    messageStorage.set('1', one);

    await handler.register(one);
    assert.isTrue(isInStorage(one.id));
    assert.equal(challengeStatus, 'required');

    await this.clock.nextAsync();

    assert.deepEqual(sent, ['1']);
    assert.equal(challengeStatus, 'idle');
    assert.isFalse(isInStorage(one.id));
  });

  it('should send challenge response', async function test() {
    const handler = await createHandler({ autoSolve: true });

    const one = createMessage('1', { retryAfter: NEVER_RETRY });
    messageStorage.set('1', one);

    await handler.register(one);
    assert.equal(challengeStatus, 'required');

    await this.clock.nextAsync();

    assert.deepEqual(sent, ['1']);
    assert.isFalse(isInStorage(one.id));
    assert.equal(challengeStatus, 'idle');
  });

  it('should send old messages', async function test() {
    const handler = await createHandler();

    // Put messages in reverse order to validate that the send order is correct
    const messages = [
      createMessage('3', { sentAt: 3 }),
      createMessage('2', { sentAt: 2 }),
      createMessage('1', { sentAt: 1 }),
    ];
    for (const message of messages) {
      messageStorage.set(message.id, message);
      await handler.register(message);
    }

    assert.equal(challengeStatus, 'required');
    assert.deepEqual(sent, []);

    for (const message of messages) {
      assert.isTrue(
        isInStorage(message.id),
        `${message.id} should be in storage`
      );
    }

    await handler.onOffline();

    // Wait for messages to mature
    await this.clock.nextAsync();

    // Create new handler to load old messages from storage
    await createHandler();
    for (const message of messages) {
      await handler.unregister(message);
    }

    for (const message of messages) {
      assert.isFalse(
        isInStorage(message.id),
        `${message.id} should not be in storage`
      );
    }

    // The order has to be correct
    assert.deepEqual(sent, ['1', '2', '3']);
    assert.equal(challengeStatus, 'idle');
  });

  it('should send message immediately if it is ready', async () => {
    const handler = await createHandler();

    const one = createMessage('1', { retryAfter: IMMEDIATE_RETRY });
    await handler.register(one);

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, ['1']);
  });

  it('should not change challenge status on non-bubble messages', async function test() {
    const handler = await createHandler();

    const one = createMessage('1', {
      isNormalBubble: false,
    });
    await handler.register(one);

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, []);

    await this.clock.nextAsync();

    assert.deepEqual(sent, ['1']);
  });

  it('should not retry expired messages', async function test() {
    const handler = await createHandler();

    const bubble = createMessage('1');
    messageStorage.set('1', bubble);
    await handler.register(bubble);
    assert.isTrue(isInStorage(bubble.id));

    const newHandler = await createHandler({
      autoSolve: true,
      expireAfter: -1,
    });
    await handler.unregister(bubble);

    challengeStatus = 'idle';
    await newHandler.load();

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, []);

    await this.clock.nextAsync();

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, []);
    assert.isFalse(isInStorage(bubble.id));
  });

  it('should send messages that matured while we were offline', async function test() {
    const handler = await createHandler();

    const one = createMessage('1');
    messageStorage.set('1', one);
    await handler.register(one);

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    await handler.onOffline();

    // Let messages mature
    await this.clock.nextAsync();

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    // Go back online
    await handler.onOnline();

    assert.isFalse(isInStorage(one.id));
    assert.deepEqual(sent, [one.id]);
    assert.equal(challengeStatus, 'idle');
  });

  it('should not retry more than 5 times', async function test() {
    const handler = await createHandler();

    const one = createMessage('1', { retryAfter: IMMEDIATE_RETRY });
    const retrySend = sinon.stub(one, 'retrySend');

    messageStorage.set('1', one);
    await handler.register(one);

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    // Wait more than 5 times
    for (let i = 0; i < 6; i += 1) {
      await this.clock.nextAsync();
    }

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    sinon.assert.callCount(retrySend, 5);
  });

  it('should trigger onChallengeSolved', async function test() {
    const onChallengeSolved = sinon.stub();

    const handler = await createHandler({
      autoSolve: true,
      onChallengeSolved,
    });

    const one = createMessage('1', { retryAfter: NEVER_RETRY });
    messageStorage.set('1', one);
    await handler.register(one);

    // Let the challenge go through
    await this.clock.nextAsync();

    sinon.assert.calledOnce(onChallengeSolved);
  });

  it('should trigger onChallengeFailed', async function test() {
    const onChallengeFailed = sinon.stub();

    const handler = await createHandler({
      autoSolve: true,
      challengeError: new Error('custom failure'),
      onChallengeFailed,
    });

    const one = createMessage('1', { retryAfter: NEVER_RETRY });
    messageStorage.set('1', one);
    await handler.register(one);

    // Let the challenge go through
    await this.clock.nextAsync();

    sinon.assert.calledOnce(onChallengeFailed);
  });
});
