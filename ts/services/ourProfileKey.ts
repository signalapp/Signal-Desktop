// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from '../util/assert';
import * as log from '../logging/log';

// We define a stricter storage here that returns `unknown` instead of `any`.
type Storage = {
  get(key: string): unknown;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  onready: (callback: () => unknown) => void;
};

export class OurProfileKeyService {
  private getPromise: undefined | Promise<undefined | ArrayBuffer>;

  private promisesBlockingGet: Array<Promise<unknown>> = [];

  private storage?: Storage;

  initialize(storage: Storage): void {
    log.info('Our profile key service: initializing');

    const storageReadyPromise = new Promise<void>(resolve => {
      storage.onready(() => {
        resolve();
      });
    });
    this.promisesBlockingGet = [storageReadyPromise];

    this.storage = storage;
  }

  get(): Promise<undefined | ArrayBuffer> {
    if (this.getPromise) {
      log.info(
        'Our profile key service: was already fetching. Piggybacking off of that'
      );
    } else {
      log.info('Our profile key service: kicking off a new fetch');
      this.getPromise = this.doGet();
    }
    return this.getPromise;
  }

  async set(newValue: undefined | ArrayBuffer): Promise<void> {
    log.info('Our profile key service: updating profile key');
    assert(this.storage, 'OurProfileKeyService was not initialized');
    if (newValue) {
      await this.storage.put('profileKey', newValue);
    } else {
      await this.storage.remove('profileKey');
    }
  }

  blockGetWithPromise(promise: Promise<unknown>): void {
    this.promisesBlockingGet.push(promise);
  }

  private async doGet(): Promise<undefined | ArrayBuffer> {
    log.info(
      `Our profile key service: waiting for ${this.promisesBlockingGet.length} promises before fetching`
    );

    await Promise.allSettled(this.promisesBlockingGet);
    this.promisesBlockingGet = [];

    delete this.getPromise;

    assert(this.storage, 'OurProfileKeyService was not initialized');

    log.info('Our profile key service: fetching profile key from storage');
    const result = this.storage.get('profileKey');
    if (result === undefined || result instanceof ArrayBuffer) {
      return result;
    }

    assert(
      false,
      'Profile key in storage was defined, but not an ArrayBuffer. Returning undefined'
    );
    return undefined;
  }
}

export const ourProfileKeyService = new OurProfileKeyService();
