// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { groupBy } from 'lodash';
import * as log from '../logging/log';
import { aciSchema } from '../types/ServiceId';
import { safeParseStrict } from './schemas';

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

const HOUR = 60 * 60 * 1000;
export const STORAGE_KEY = 'retryPlaceholders';

export function getDeltaIntoPast(delta?: number): number {
  return Date.now() - (delta || HOUR);
}

export class RetryPlaceholders {
  #items: Array<RetryItemType>;
  #byConversation: ByConversationLookupType;
  #byMessage: ByMessageLookupType;
  #retryReceiptLifespan: number;

  constructor(options: { retryReceiptLifespan?: number } = {}) {
    if (!window.storage) {
      throw new Error(
        'RetryPlaceholders.constructor: window.storage not available!'
      );
    }

    const parsed = safeParseStrict(
      retryItemListSchema,
      window.storage.get(STORAGE_KEY, new Array<RetryItemType>())
    );
    if (!parsed.success) {
      log.warn(
        `RetryPlaceholders.constructor: Data fetched from storage did not match schema: ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    this.#items = parsed.success ? parsed.data : [];
    this.sortByExpiresAtAsc();
    this.#byConversation = this.makeByConversationLookup();
    this.#byMessage = this.makeByMessageLookup();
    this.#retryReceiptLifespan = options.retryReceiptLifespan || HOUR;

    log.info(
      `RetryPlaceholders.constructor: Started with ${this.#items.length} items, lifespan of ${this.#retryReceiptLifespan}`
    );
  }

  // Arranging local data for efficiency

  sortByExpiresAtAsc(): void {
    this.#items.sort(
      (left: RetryItemType, right: RetryItemType) =>
        left.receivedAt - right.receivedAt
    );
  }

  makeByConversationLookup(): ByConversationLookupType {
    return groupBy(this.#items, item => item.conversationId);
  }

  makeByMessageLookup(): ByMessageLookupType {
    const lookup = new Map<string, RetryItemType>();
    this.#items.forEach(item => {
      lookup.set(getItemId(item.conversationId, item.sentAt), item);
    });
    return lookup;
  }

  makeLookups(): void {
    this.#byConversation = this.makeByConversationLookup();
    this.#byMessage = this.makeByMessageLookup();
  }

  // Basic data management

  async add(item: RetryItemType): Promise<void> {
    const parsed = safeParseStrict(retryItemSchema, item);
    if (!parsed.success) {
      throw new Error(
        `RetryPlaceholders.add: Item did not match schema ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    this.#items.push(item);
    this.sortByExpiresAtAsc();
    this.makeLookups();
    await this.save();
  }

  async save(): Promise<void> {
    await window.storage.put(STORAGE_KEY, this.#items);
  }

  // Finding items in different ways

  getCount(): number {
    return this.#items.length;
  }

  getNextToExpire(): RetryItemType | undefined {
    return this.#items[0];
  }

  async getExpiredAndRemove(): Promise<Array<RetryItemType>> {
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

    log.info(
      `RetryPlaceholders.getExpiredAndRemove: Found ${result.length} expired items`
    );

    this.#items.splice(0, result.length);
    this.makeLookups();
    await this.save();

    return result;
  }

  async findByConversationAndMarkOpened(conversationId: string): Promise<void> {
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
        `RetryPlaceholders.findByConversationAndMarkOpened: Updated ${changed} items for conversation ${conversationId}`
      );

      await this.save();
    }
  }

  async findByMessageAndRemove(
    conversationId: string,
    sentAt: number
  ): Promise<RetryItemType | undefined> {
    const result = this.#byMessage.get(getItemId(conversationId, sentAt));
    if (!result) {
      return undefined;
    }

    const index = this.#items.findIndex(item => item === result);

    this.#items.splice(index, 1);
    this.makeLookups();

    log.info(
      `RetryPlaceholders.findByMessageAndRemove: Removing ${sentAt} from conversation ${conversationId}`
    );
    await this.save();

    return result;
  }
}
