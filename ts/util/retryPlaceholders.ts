// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { groupBy } from 'lodash';

const retryItemSchema = z
  .object({
    conversationId: z.string(),
    sentAt: z.number(),
    receivedAt: z.number(),
    receivedAtCounter: z.number(),
    senderUuid: z.string(),
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

export function getOneHourAgo(): number {
  return Date.now() - HOUR;
}

export class RetryPlaceholders {
  private items: Array<RetryItemType>;

  private byConversation: ByConversationLookupType;

  private byMessage: ByMessageLookupType;

  constructor() {
    if (!window.storage) {
      throw new Error(
        'RetryPlaceholders.constructor: window.storage not available!'
      );
    }

    const parsed = retryItemListSchema.safeParse(
      window.storage.get(STORAGE_KEY) || []
    );
    if (!parsed.success) {
      window.log.warn(
        `RetryPlaceholders.constructor: Data fetched from storage did not match schema: ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    this.items = parsed.success ? parsed.data : [];
    window.log.info(
      `RetryPlaceholders.constructor: Started with ${this.items.length} items`
    );

    this.sortByExpiresAtAsc();
    this.byConversation = this.makeByConversationLookup();
    this.byMessage = this.makeByMessageLookup();
  }

  // Arranging local data for efficiency

  sortByExpiresAtAsc(): void {
    this.items.sort(
      (left: RetryItemType, right: RetryItemType) =>
        left.receivedAt - right.receivedAt
    );
  }

  makeByConversationLookup(): ByConversationLookupType {
    return groupBy(this.items, item => item.conversationId);
  }

  makeByMessageLookup(): ByMessageLookupType {
    const lookup = new Map<string, RetryItemType>();
    this.items.forEach(item => {
      lookup.set(getItemId(item.conversationId, item.sentAt), item);
    });
    return lookup;
  }

  makeLookups(): void {
    this.byConversation = this.makeByConversationLookup();
    this.byMessage = this.makeByMessageLookup();
  }

  // Basic data management

  async add(item: RetryItemType): Promise<void> {
    const parsed = retryItemSchema.safeParse(item);
    if (!parsed.success) {
      throw new Error(
        `RetryPlaceholders.add: Item did not match schema ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    this.items.push(item);
    this.sortByExpiresAtAsc();
    this.makeLookups();
    await this.save();
  }

  async save(): Promise<void> {
    await window.storage.put(STORAGE_KEY, this.items);
  }

  // Finding items in different ways

  getCount(): number {
    return this.items.length;
  }

  getNextToExpire(): RetryItemType | undefined {
    return this.items[0];
  }

  async getExpiredAndRemove(): Promise<Array<RetryItemType>> {
    const expiration = getOneHourAgo();
    const max = this.items.length;
    const result: Array<RetryItemType> = [];

    for (let i = 0; i < max; i += 1) {
      const item = this.items[i];
      if (item.receivedAt <= expiration) {
        result.push(item);
      } else {
        break;
      }
    }

    window.log.info(
      `RetryPlaceholders.getExpiredAndRemove: Found ${result.length} expired items`
    );

    this.items.splice(0, result.length);
    this.makeLookups();
    await this.save();

    return result;
  }

  async findByConversationAndRemove(
    conversationId: string
  ): Promise<Array<RetryItemType>> {
    const result = this.byConversation[conversationId];
    if (!result) {
      return [];
    }

    const items = this.items.filter(
      item => item.conversationId !== conversationId
    );

    window.log.info(
      `RetryPlaceholders.findByConversationAndRemove: Found ${result.length} expired items`
    );

    this.items = items;
    this.sortByExpiresAtAsc();
    this.makeLookups();
    await this.save();

    return result;
  }

  async findByMessageAndRemove(
    conversationId: string,
    sentAt: number
  ): Promise<RetryItemType | undefined> {
    const result = this.byMessage.get(getItemId(conversationId, sentAt));
    if (!result) {
      return undefined;
    }

    const index = this.items.findIndex(item => item === result);

    this.items.splice(index, 1);
    this.makeLookups();
    await this.save();

    return result;
  }
}
