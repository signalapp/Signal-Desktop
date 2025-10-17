// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import lodash from 'lodash';
import { createLogger } from '../logging/log.std.js';
import { aciSchema } from '../types/ServiceId.std.js';
import { safeParseStrict } from '../util/schemas.std.js';
import { HOUR } from '../util/durations/index.std.js';
import type { StorageInterface } from '../types/Storage.d.ts';

const { groupBy } = lodash;

const log = createLogger('retryPlaceholders');

const retryItemSchema = z
  .object({
    conversationId: z.string(),
    sentAt: z.number(),
    receivedAt: z.number(),
    receivedAtCounter: z.number(),
    senderAci: aciSchema,
    wasOpened: z.boolean().optional(),
  })
  .passthrough();
export type RetryItemType = z.infer<typeof retryItemSchema>;

const retryItemListSchema = z.array(retryItemSchema);
export type RetryItemListType = z.infer<typeof retryItemListSchema>;

export type ByConversationLookupType = {
  [key: string]: Array<RetryItemType>;
};
export type ByMessageLookupType = Map<string, RetryItemType>;

export function getItemId(conversationId: string, sentAt: number): string {
  return `${conversationId}--${sentAt}`;
}

export const STORAGE_KEY = 'retryPlaceholders';

export function getDeltaIntoPast(delta?: number): number {
  return Date.now() - (delta || HOUR);
}

export class RetryPlaceholders {
  #isStarted = false;
  #items = new Array<RetryItemType>();
  #byConversation: ByConversationLookupType = {};
  #byMessage: ByMessageLookupType = new Map();
  #retryReceiptLifespan: number;
  #storage: Pick<StorageInterface, 'get' | 'put'> | undefined;

  constructor(options: { retryReceiptLifespan?: number } = {}) {
    this.#retryReceiptLifespan = options.retryReceiptLifespan || HOUR;
  }

  start(storage: Pick<StorageInterface, 'get' | 'put'>): void {
    if (this.#isStarted) {
      throw new Error('RetryPlaceholders: already started');
    }

    const parsed = safeParseStrict(
      retryItemListSchema,
      storage.get(STORAGE_KEY, new Array<RetryItemType>())
    );
    if (!parsed.success) {
      log.warn(
        `constructor: Data fetched from storage did not match schema: ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    this.#items = parsed.success ? parsed.data : [];
    this.#sortByExpiresAtAsc();
    this.#byConversation = this.#makeByConversationLookup();
    this.#byMessage = this.#makeByMessageLookup();
    this.#isStarted = true;
    this.#storage = storage;
    log.info(
      `constructor: Started with ${this.#items.length} items, lifespan of ${this.#retryReceiptLifespan}`
    );
  }

  // Arranging local data for efficiency

  #sortByExpiresAtAsc(): void {
    this.#items.sort(
      (left: RetryItemType, right: RetryItemType) =>
        left.receivedAt - right.receivedAt
    );
  }

  #makeByConversationLookup(): ByConversationLookupType {
    return groupBy(this.#items, item => item.conversationId);
  }

  #makeByMessageLookup(): ByMessageLookupType {
    const lookup = new Map<string, RetryItemType>();
    this.#items.forEach(item => {
      lookup.set(getItemId(item.conversationId, item.sentAt), item);
    });
    return lookup;
  }

  #makeLookups(): void {
    this.#byConversation = this.#makeByConversationLookup();
    this.#byMessage = this.#makeByMessageLookup();
  }

  // Basic data management

  async add(item: RetryItemType): Promise<void> {
    if (!this.#isStarted) {
      throw new Error('RetryPlaceholders: not started');
    }

    const parsed = safeParseStrict(retryItemSchema, item);
    if (!parsed.success) {
      throw new Error(
        `RetryPlaceholders.add: Item did not match schema ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    this.#items.push(item);
    this.#sortByExpiresAtAsc();
    this.#makeLookups();
    await this.save();
  }

  async save(): Promise<void> {
    if (!this.#isStarted || this.#storage == null) {
      throw new Error('RetryPlaceholders: not started');
    }

    await this.#storage.put(STORAGE_KEY, this.#items);
  }

  // Finding items in different ways

  getCount(): number {
    if (!this.#isStarted) {
      throw new Error('RetryPlaceholders: not started');
    }

    return this.#items.length;
  }

  getNextToExpire(): RetryItemType | undefined {
    if (!this.#isStarted) {
      throw new Error('RetryPlaceholders: not started');
    }
    return this.#items[0];
  }

  async getExpiredAndRemove(): Promise<Array<RetryItemType>> {
    if (!this.#isStarted) {
      throw new Error('RetryPlaceholders: not started');
    }
    const expiration = getDeltaIntoPast(this.#retryReceiptLifespan);
    const max = this.#items.length;
    const result: Array<RetryItemType> = [];

    for (let i = 0; i < max; i += 1) {
      const item = this.#items[i];
      if (item.receivedAt <= expiration) {
        result.push(item);
      } else {
        break;
      }
    }

    log.info(`getExpiredAndRemove: Found ${result.length} expired items`);

    this.#items.splice(0, result.length);
    this.#makeLookups();
    await this.save();

    return result;
  }

  async findByConversationAndMarkOpened(conversationId: string): Promise<void> {
    if (!this.#isStarted) {
      throw new Error('RetryPlaceholders: not started');
    }
    let changed = 0;
    const items = this.#byConversation[conversationId];
    (items || []).forEach(item => {
      if (!item.wasOpened) {
        changed += 1;
        // eslint-disable-next-line no-param-reassign
        item.wasOpened = true;
      }
    });

    if (changed > 0) {
      log.info(
        `findByConversationAndMarkOpened: Updated ${changed} items for conversation ${conversationId}`
      );

      await this.save();
    }
  }

  async findByMessageAndRemove(
    conversationId: string,
    sentAt: number
  ): Promise<RetryItemType | undefined> {
    if (!this.#isStarted) {
      throw new Error('RetryPlaceholders: not started');
    }
    const result = this.#byMessage.get(getItemId(conversationId, sentAt));
    if (!result) {
      return undefined;
    }

    const index = this.#items.findIndex(item => item === result);

    this.#items.splice(index, 1);
    this.#makeLookups();

    log.info(
      `findByMessageAndRemove: Removing ${sentAt} from conversation ${conversationId}`
    );
    await this.save();

    return result;
  }
}

export const retryPlaceholders = new RetryPlaceholders({
  retryReceiptLifespan: HOUR,
});
