// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageInterface } from '../types/Storage.d.ts';
import type {
  getHasSubscription,
  isOnline,
} from '../textsecure/WebAPI.preload.js';
import { LatestQueue } from '../util/LatestQueue.std.js';
import { waitForOnline } from '../util/waitForOnline.dom.js';

// This is only exported for testing.
export class AreWeASubscriberService {
  readonly #queue = new LatestQueue();

  update(
    storage: Pick<StorageInterface, 'get' | 'put' | 'onready'>,
    server: {
      getHasSubscription: typeof getHasSubscription;
      isOnline: typeof isOnline;
    }
  ): void {
    this.#queue.add(async () => {
      await new Promise<void>(resolve => storage.onready(resolve));

      const subscriberId = storage.get('subscriberId');
      if (!subscriberId || !subscriberId.byteLength) {
        await storage.put('areWeASubscriber', false);
        return;
      }

      await waitForOnline({ server });

      await storage.put(
        'areWeASubscriber',
        await server.getHasSubscription(subscriberId)
      );
    });
  }
}

export const areWeASubscriberService = new AreWeASubscriberService();
