// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { sleep } from '../../util/sleep.std.ts';
import { MINUTE } from '../../util/durations/index.std.ts';
import { drop } from '../../util/drop.std.ts';

import { ProfileService } from '../../services/profiles.preload.ts';
import { HTTPError } from '../../types/HTTPError.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';

import type { ConversationModel } from '../../models/conversations.preload.ts';

describe('util/profiles', () => {
  const SERVICE_ID_1 = generateAci();
  const SERVICE_ID_2 = generateAci();
  const SERVICE_ID_3 = generateAci();
  const SERVICE_ID_4 = generateAci();
  const SERVICE_ID_5 = generateAci();

  beforeEach(async () => {
    await window.ConversationController.getOrCreateAndWait(
      SERVICE_ID_1,
      'private'
    );
    await window.ConversationController.getOrCreateAndWait(
      SERVICE_ID_2,
      'private'
    );
    await window.ConversationController.getOrCreateAndWait(
      SERVICE_ID_3,
      'private'
    );
    await window.ConversationController.getOrCreateAndWait(
      SERVICE_ID_4,
      'private'
    );
    await window.ConversationController.getOrCreateAndWait(
      SERVICE_ID_5,
      'private'
    );
  });

  let profileFetches: Set<string>;

  beforeEach(() => {
    profileFetches = new Set();
  });

  describe('clearAll', () => {
    it('Cancels all in-flight requests', async () => {
      const getProfileWithLongDelay = async (
        conversation: ConversationModel
      ) => {
        const serviceId = conversation.get('serviceId');
        if (!serviceId) {
          throw new Error('missing serviceId!');
        }
        profileFetches.add(serviceId);
        await sleep(MINUTE);
      };
      const service = new ProfileService(getProfileWithLongDelay, 3);

      const promise1 = service.get(SERVICE_ID_1, null);
      const promise2 = service.get(SERVICE_ID_2, null);
      const promise3 = service.get(SERVICE_ID_3, null);
      const promise4 = service.get(SERVICE_ID_4, null);

      service.clearAll('testing');

      await Promise.all([promise1, promise2, promise3, promise4]);

      assert.strictEqual(3, profileFetches.size);
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_1),
        true,
        'SERVICE_ID_1'
      );
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_2),
        true,
        'SERVICE_ID_2'
      );
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_3),
        true,
        'SERVICE_ID_3'
      );
    });
  });

  describe('pause', () => {
    it('pauses the queue', async () => {
      const getProfileWithIncrement = (conversation: ConversationModel) => {
        const serviceId = conversation.get('serviceId');
        if (!serviceId) {
          throw new Error('missing serviceId!');
        }
        profileFetches.add(serviceId);
        return Promise.resolve();
      };
      const service = new ProfileService(getProfileWithIncrement, 3);

      // Queued and immediately started due to concurrency = 3
      drop(service.get(SERVICE_ID_1, null));
      drop(service.get(SERVICE_ID_2, null));
      drop(service.get(SERVICE_ID_3, null));

      // Queued but only run after paused queue restarts
      const lastPromise = service.get(SERVICE_ID_4, null);

      const pausePromise = service.pause(5);

      assert.strictEqual(profileFetches.size, 3, 'as pause starts');
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_1),
        true,
        'SERVICE_ID_1'
      );
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_2),
        true,
        'SERVICE_ID_2'
      );
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_3),
        true,
        'SERVICE_ID_3'
      );

      await pausePromise;
      await lastPromise;

      assert.strictEqual(profileFetches.size, 4, 'after last promise');
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_4),
        true,
        'SERVICE_ID_4'
      );
    });
  });

  describe('get', () => {
    it('throws if we are currently paused', async () => {
      const getProfileWithIncrement = (conversation: ConversationModel) => {
        const serviceId = conversation.get('serviceId');
        if (!serviceId) {
          throw new Error('missing serviceId!');
        }
        profileFetches.add(serviceId);
        return Promise.resolve();
      };
      const service = new ProfileService(getProfileWithIncrement, 3);

      const pausePromise = service.pause(5);

      // None of these are even queued
      const promise1 = service.get(SERVICE_ID_1, null);
      const promise2 = service.get(SERVICE_ID_2, null);
      const promise3 = service.get(SERVICE_ID_3, null);
      const promise4 = service.get(SERVICE_ID_4, null);

      await Promise.all([pausePromise, promise1, promise2, promise3, promise4]);

      assert.strictEqual(profileFetches.size, 0);
    });

    for (const code of [413, 429] as const) {
      // oxlint-disable-next-line no-loop-func
      it(`clears all outstanding jobs if we get a ${code}, then pauses`, async () => {
        const getProfileWhichThrows = async (
          conversation: ConversationModel
        ) => {
          const serviceId = conversation.get('serviceId');
          if (!serviceId) {
            throw new Error('missing serviceId!');
          }
          profileFetches.add(serviceId);
          const error = new HTTPError(`fake ${code}`, {
            code,
            headers: {
              'retry-after': '1',
            },
          });
          throw error;
        };
        const service = new ProfileService(getProfileWhichThrows, 3);

        // Queued and immediately started due to concurrency = 3
        const promise1 = service.get(SERVICE_ID_1, null);
        const promise2 = service.get(SERVICE_ID_2, null);
        const promise3 = service.get(SERVICE_ID_3, null);

        // Never started, but queued
        const promise4 = service.get(SERVICE_ID_4, null);

        assert.strictEqual(profileFetches.size, 3, 'before await');
        assert.strictEqual(
          profileFetches.has(SERVICE_ID_1),
          true,
          'SERVICE_ID_1'
        );
        assert.strictEqual(
          profileFetches.has(SERVICE_ID_2),
          true,
          'SERVICE_ID_2'
        );
        assert.strictEqual(
          profileFetches.has(SERVICE_ID_3),
          true,
          'SERVICE_ID_3'
        );

        // It didn't succeed, but we log and resolve as normal
        await assert.isFulfilled(promise1);

        // Never queued
        const promise5 = service.get(SERVICE_ID_5, null);

        await Promise.all([promise2, promise3, promise4, promise5]);

        assert.strictEqual(profileFetches.size, 3, 'after await');
      });
    }

    it('clears all outstanding jobs if we get a -1', async () => {
      const getProfileWhichThrows = async (conversation: ConversationModel) => {
        const serviceId = conversation.get('serviceId');
        if (!serviceId) {
          throw new Error('missing serviceId!');
        }
        profileFetches.add(serviceId);
        const error = new HTTPError('fake -1', {
          code: -1,
          headers: {},
        });
        throw error;
      };
      const service = new ProfileService(getProfileWhichThrows, 3);

      // Queued and immediately started due to concurrency = 3
      const promise1 = service.get(SERVICE_ID_1, null);
      const promise2 = service.get(SERVICE_ID_2, null);
      const promise3 = service.get(SERVICE_ID_3, null);

      // Never started, but queued
      const promise4 = service.get(SERVICE_ID_4, null);

      // It didn't succeed, but we log and resolve as normal
      await Promise.all([promise1, promise2, promise3, promise4]);

      assert.strictEqual(profileFetches.size, 3, 'before await');
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_1),
        true,
        'SERVICE_ID_1'
      );
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_2),
        true,
        'SERVICE_ID_2'
      );
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_3),
        true,
        'SERVICE_ID_3'
      );

      // Queued, because we aren't pausing
      const promise5 = service.get(SERVICE_ID_5, null);

      // It didn't succeed, but we log and resolve as normal
      await assert.isFulfilled(promise5);

      assert.strictEqual(profileFetches.size, 4, 'after await');
      assert.strictEqual(
        profileFetches.has(SERVICE_ID_5),
        true,
        'SERVICE_ID_5'
      );
    });
  });
});
