// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageInterface } from '../types/Storage.d';
import type { WebAPIType } from '../textsecure/WebAPI';
import { LatestQueue } from '../util/LatestQueue';
import { waitForOnline } from '../util/waitForOnline';

// This is only exported for testing.
export class AreWeASubscriberService {
  readonly #queue = new LatestQueue();

  update(
    storage: Pick<StorageInterface, 'get' | 'put' | 'onready'>,
    server: Pick<WebAPIType, 'getHasSubscription' | 'isOnline'>
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
