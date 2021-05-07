// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop, no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import { noop } from 'lodash';
import * as sinon from 'sinon';

import { sleep } from '../util/sleep';
import { ChallengeHandler, MinimalMessage } from '../challenge';

type CreateMessageOptions = {
  readonly sentAt?: number;
  readonly retryAfter?: number;
  readonly isNormalBubble?: boolean;
};

type CreateHandlerOptions = {
  readonly challenge?: boolean;
  readonly challengeError?: Error;
  readonly expireAfter?: number;
  readonly onChallengeSolved?: () => void;
  readonly onChallengeFailed?: (retryAfter?: number) => void;
};

const NEVER_RETRY = Date.now() + 365 * 24 * 3600 * 1000;

describe('ChallengeHandler', () => {
  const storage = new Map<string, any>();
  const messageStorage = new Map<string, MinimalMessage>();
  let challengeStatus = 'idle';
  let sent: Array<string> = [];

  beforeEach(() => {
    storage.clear();
    messageStorage.clear();
    challengeStatus = 'idle';
    sent = [];
  });

  const createMessage = (
    id: string,
    options: CreateMessageOptions = {}
  ): MinimalMessage => {
    const {
      sentAt = 0,
      isNormalBubble = true,
      retryAfter = Date.now() + 25,
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
        await sleep(5);
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
    challenge = false,
    challengeError,
    expireAfter,
    onChallengeSolved = noop,
    onChallengeFailed = noop,
  }: CreateHandlerOptions = {}): Promise<ChallengeHandler> => {
    const handler = new ChallengeHandler({
      expireAfter,

      storage: {
        get(key) {
          return storage.get(key);
        },
        async put(key, value) {
          storage.set(key, value);
        },
      },

      onChallengeSolved,
      onChallengeFailed,

      requestChallenge(request) {
        if (!challenge) {
          return;
        }

        setTimeout(() => {
          handler.onResponse({
            seq: request.seq,
            data: { captcha: 'captcha' },
          });
        }, 5);
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

  it('should automatically retry after timeout', async () => {
    const handler = await createHandler();

    const one = createMessage('1');
    messageStorage.set('1', one);

    await handler.register(one);
    assert.isTrue(isInStorage(one.id));
    assert.equal(challengeStatus, 'required');

    await sleep(50);

    assert.deepEqual(sent, ['1']);
    assert.equal(challengeStatus, 'idle');
    assert.isFalse(isInStorage(one.id));
  });

  it('should send challenge response', async () => {
    const handler = await createHandler({ challenge: true });

    const one = createMessage('1', { retryAfter: NEVER_RETRY });
    messageStorage.set('1', one);

    await handler.register(one);
    assert.equal(challengeStatus, 'required');

    await sleep(50);

    assert.deepEqual(sent, ['1']);
    assert.isFalse(isInStorage(one.id));
    assert.equal(challengeStatus, 'idle');
  });

  it('should send old messages', async () => {
    const handler = await createHandler();

    const retryAfter = Date.now() + 50;

    // Put messages in reverse order to validate that the send order is correct
    const messages = [
      createMessage('3', { sentAt: 3, retryAfter }),
      createMessage('2', { sentAt: 2, retryAfter }),
      createMessage('1', { sentAt: 1, retryAfter }),
    ];
    for (const message of messages) {
      messageStorage.set(message.id, message);
      await handler.register(message);
    }

    assert.equal(challengeStatus, 'required');
    assert.deepEqual(sent, []);

    assert.equal(challengeStatus, 'required');
    for (const message of messages) {
      assert.isTrue(
        isInStorage(message.id),
        `${message.id} should be in storage`
      );
    }

    await handler.onOffline();

    // Wait for messages to mature
    await sleep(50);

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

    const one = createMessage('1', { retryAfter: Date.now() - 100 });
    await handler.register(one);

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, ['1']);
  });

  it('should not change challenge status on non-bubble messages', async () => {
    const handler = await createHandler();

    const one = createMessage('1', { isNormalBubble: false });
    await handler.register(one);

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, []);

    await sleep(50);
    assert.deepEqual(sent, ['1']);
  });

  it('should not retry expired messages', async () => {
    const handler = await createHandler();

    const bubble = createMessage('1');
    messageStorage.set('1', bubble);
    await handler.register(bubble);
    assert.isTrue(isInStorage(bubble.id));

    const newHandler = await createHandler({
      challenge: true,
      expireAfter: -1,
    });
    await handler.unregister(bubble);

    challengeStatus = 'idle';
    await newHandler.load();

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, []);

    await sleep(25);

    assert.equal(challengeStatus, 'idle');
    assert.deepEqual(sent, []);
    assert.isFalse(isInStorage(bubble.id));
  });

  it('should send messages that matured while we were offline', async () => {
    const handler = await createHandler();

    const one = createMessage('1');
    messageStorage.set('1', one);
    await handler.register(one);

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    await handler.onOffline();

    // Let messages mature
    await sleep(50);

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    // Go back online
    await handler.onOnline();

    assert.isFalse(isInStorage(one.id));
    assert.deepEqual(sent, [one.id]);
    assert.equal(challengeStatus, 'idle');
  });

  it('should not retry more than 5 times', async () => {
    const handler = await createHandler();

    const one = createMessage('1', {
      retryAfter: Date.now() + 50,
    });
    messageStorage.set('1', one);
    await handler.register(one);

    const retrySend = sinon.stub(one, 'retrySend');

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    // Let it spam the server
    await sleep(100);

    assert.isTrue(isInStorage(one.id));
    assert.deepEqual(sent, []);
    assert.equal(challengeStatus, 'required');

    sinon.assert.callCount(retrySend, 5);
  });

  it('should trigger onChallengeSolved', async () => {
    const onChallengeSolved = sinon.stub();

    const handler = await createHandler({
      challenge: true,
      onChallengeSolved,
    });

    const one = createMessage('1', {
      retryAfter: NEVER_RETRY,
    });
    messageStorage.set('1', one);
    await handler.register(one);

    // Let the challenge go through
    await sleep(50);

    sinon.assert.calledOnce(onChallengeSolved);
  });

  it('should trigger onChallengeFailed', async () => {
    const onChallengeFailed = sinon.stub();

    const handler = await createHandler({
      challenge: true,
      challengeError: new Error('custom failure'),
      onChallengeFailed,
    });

    const one = createMessage('1', {
      retryAfter: NEVER_RETRY,
    });
    messageStorage.set('1', one);
    await handler.register(one);

    // Let the challenge go through
    await sleep(50);

    sinon.assert.calledOnce(onChallengeFailed);
  });
});
