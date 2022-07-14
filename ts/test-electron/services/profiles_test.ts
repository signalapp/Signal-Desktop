// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { sleep } from '../../util';
import { MINUTE } from '../../util/durations';

import { ProfileService } from '../../services/profiles';
import { UUID } from '../../types/UUID';
import { HTTPError } from '../../textsecure/Errors';

describe('util/profiles', () => {
  const UUID_1 = UUID.generate().toString();
  const UUID_2 = UUID.generate().toString();
  const UUID_3 = UUID.generate().toString();
  const UUID_4 = UUID.generate().toString();
  const UUID_5 = UUID.generate().toString();

  beforeEach(async () => {
    await window.ConversationController.getOrCreateAndWait(UUID_1, 'private');
    await window.ConversationController.getOrCreateAndWait(UUID_2, 'private');
    await window.ConversationController.getOrCreateAndWait(UUID_3, 'private');
    await window.ConversationController.getOrCreateAndWait(UUID_4, 'private');
    await window.ConversationController.getOrCreateAndWait(UUID_5, 'private');
  });

  describe('clearAll', () => {
    it('Cancels all in-flight requests', async () => {
      const getProfileWithLongDelay = async () => {
        await sleep(MINUTE);
      };
      const service = new ProfileService(getProfileWithLongDelay);

      const promise1 = service.get(UUID_1);
      const promise2 = service.get(UUID_2);
      const promise3 = service.get(UUID_3);
      const promise4 = service.get(UUID_4);

      service.clearAll('testing');

      await assert.isRejected(promise1, 'job cancelled');
      await assert.isRejected(promise2, 'job cancelled');
      await assert.isRejected(promise3, 'job cancelled');
      await assert.isRejected(promise4, 'job cancelled');
    });
  });

  describe('pause', () => {
    it('pauses the queue', async () => {
      let runCount = 0;
      const getProfileWithIncrement = () => {
        runCount += 1;
        return Promise.resolve();
      };
      const service = new ProfileService(getProfileWithIncrement);

      // Queued and immediately started due to concurrency = 3
      service.get(UUID_1);
      service.get(UUID_2);
      service.get(UUID_3);

      // Queued but only run after paused queue restarts
      const lastPromise = service.get(UUID_4);

      const pausePromise = service.pause(5);

      assert.strictEqual(runCount, 3, 'as pause starts');

      await pausePromise;
      await lastPromise;

      assert.strictEqual(runCount, 4, 'after last promise');
    });
  });

  describe('get', () => {
    it('throws if we are currently paused', async () => {
      let runCount = 0;
      const getProfileWithIncrement = () => {
        runCount += 1;
        return Promise.resolve();
      };
      const service = new ProfileService(getProfileWithIncrement);

      const pausePromise = service.pause(5);

      // None of these are even queued
      const promise1 = service.get(UUID_1);
      const promise2 = service.get(UUID_2);
      const promise3 = service.get(UUID_3);
      const promise4 = service.get(UUID_4);

      await assert.isRejected(promise1, 'paused queue');
      await assert.isRejected(promise2, 'paused queue');
      await assert.isRejected(promise3, 'paused queue');
      await assert.isRejected(promise4, 'paused queue');

      await pausePromise;

      assert.strictEqual(runCount, 0);
    });

    it('clears all outstanding jobs if we get a 413, then pauses', async () => {
      let runCount = 0;
      const getProfileWhichThrows = async () => {
        runCount += 1;
        const error = new HTTPError('fake 413', {
          code: 413,
          headers: {
            'retry-after': '1',
          },
        });
        throw error;
      };
      const service = new ProfileService(getProfileWhichThrows);

      // Queued and immediately started due to concurrency = 3
      const promise1 = service.get(UUID_1);
      const promise2 = service.get(UUID_2);
      const promise3 = service.get(UUID_3);

      // Never started, but queued
      const promise4 = service.get(UUID_4);

      assert.strictEqual(runCount, 3, 'before await');

      await assert.isRejected(promise1, 'fake 413');

      // Never queued
      const promise5 = service.get(UUID_5);

      await assert.isRejected(promise2, 'job cancelled');
      await assert.isRejected(promise3, 'job cancelled');
      await assert.isRejected(promise4, 'job cancelled');
      await assert.isRejected(promise5, 'paused queue');

      assert.strictEqual(runCount, 3, 'after await');
    });
  });
});
