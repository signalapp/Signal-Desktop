// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import sinon from 'sinon';

import { generateAci } from '../../types/ServiceId.std.js';
import type { RetryItemType } from '../../services/retryPlaceholders.std.js';
import {
  getDeltaIntoPast,
  RetryPlaceholders,
  STORAGE_KEY,
} from '../../services/retryPlaceholders.std.js';

describe('RetryPlaceholders', () => {
  const NOW = 1_000_000;
  let sandbox: sinon.SinonSandbox;

  const storageMap = new Map<string, unknown>();
  const storage = {
    get: (key: string): unknown => storageMap.get(key),
    put: async (key: string, value: unknown): Promise<void> => {
      storageMap.set(key, value);
    },
  };

  beforeEach(async () => {
    storageMap.clear();

    sandbox = sinon.createSandbox();
    sandbox.useFakeTimers({
      now: NOW,
    });
  });

  afterEach(async () => {
    sandbox.restore();
  });

  function getDefaultItem(): RetryItemType {
    return {
      conversationId: 'conversation-id',
      sentAt: NOW - 10,
      receivedAt: NOW - 5,
      receivedAtCounter: 4,
      senderAci: generateAci(),
    };
  }

  describe('constructor', () => {
    it('loads previously-saved data on creation', async () => {
      const items: Array<RetryItemType> = [
        getDefaultItem(),
        { ...getDefaultItem(), conversationId: 'conversation-id-2' },
      ];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);

      assert.strictEqual(2, placeholders.getCount());
    });
    it('starts with no data if provided data fails to parse', async () => {
      await storage.put(STORAGE_KEY, [
        { item: 'is wrong shape!' },
        { bad: 'is not good!' },
      ]);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);

      assert.strictEqual(0, placeholders.getCount());
    });
  });

  describe('#add', () => {
    it('adds one item', async () => {
      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      await placeholders.add(getDefaultItem());
      assert.strictEqual(1, placeholders.getCount());
    });

    it('throws if provided data fails to parse', async () => {
      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      await assert.isRejected(
        placeholders.add({
          item: 'is wrong shape!',
        } as unknown as RetryItemType),
        'Item did not match schema'
      );
    });
  });

  describe('#getNextToExpire', () => {
    it('returns nothing if no items', () => {
      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(0, placeholders.getCount());
      assert.isUndefined(placeholders.getNextToExpire());
    });
    it('returns only item if just one item', async () => {
      const item = getDefaultItem();
      const items: Array<RetryItemType> = [item];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(1, placeholders.getCount());
      assert.deepEqual(item, placeholders.getNextToExpire());
    });
    it('returns soonest expiration given a list, and after add', async () => {
      const older = {
        ...getDefaultItem(),
        receivedAt: NOW,
      };
      const newer = {
        ...getDefaultItem(),
        receivedAt: NOW + 10,
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      assert.deepEqual(older, placeholders.getNextToExpire());

      const oldest = {
        ...getDefaultItem(),
        receivedAt: NOW - 5,
      };

      await placeholders.add(oldest);
      assert.strictEqual(3, placeholders.getCount());
      assert.deepEqual(oldest, placeholders.getNextToExpire());
    });
  });

  describe('#getExpiredAndRemove', () => {
    it('does nothing if no item expired', async () => {
      const older = {
        ...getDefaultItem(),
        receivedAt: NOW + 10,
      };
      const newer = {
        ...getDefaultItem(),
        receivedAt: NOW + 15,
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      assert.deepEqual([], await placeholders.getExpiredAndRemove());
      assert.strictEqual(2, placeholders.getCount());
    });
    it('removes just one if expired', async () => {
      const older = {
        ...getDefaultItem(),
        receivedAt: getDeltaIntoPast() - 1000,
      };
      const newer = {
        ...getDefaultItem(),
        receivedAt: NOW + 15,
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      assert.deepEqual([older], await placeholders.getExpiredAndRemove());
      assert.strictEqual(1, placeholders.getCount());
      assert.deepEqual(newer, placeholders.getNextToExpire());
    });
    it('removes all if expired', async () => {
      const older = {
        ...getDefaultItem(),
        receivedAt: getDeltaIntoPast() - 1000,
      };
      const newer = {
        ...getDefaultItem(),
        receivedAt: getDeltaIntoPast() - 900,
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      assert.deepEqual(
        [older, newer],
        await placeholders.getExpiredAndRemove()
      );
      assert.strictEqual(0, placeholders.getCount());
    });
  });

  describe('#findByConversationAndMarkOpened', () => {
    it('does nothing if no items found matching conversation', async () => {
      const older = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
      };
      const newer = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-2',
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      await placeholders.findByConversationAndMarkOpened('conversation-id-3');
      assert.strictEqual(2, placeholders.getCount());

      const saveItems = storage.get(STORAGE_KEY);
      assert.deepEqual([older, newer], saveItems);
    });
    it('updates all items matching conversation', async () => {
      const convo1a = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
        receivedAt: NOW - 5,
      };
      const convo1b = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
        receivedAt: NOW - 4,
      };
      const convo2a = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-2',
        receivedAt: NOW + 15,
      };
      const items: Array<RetryItemType> = [convo1a, convo1b, convo2a];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(3, placeholders.getCount());
      await placeholders.findByConversationAndMarkOpened('conversation-id-1');
      assert.strictEqual(3, placeholders.getCount());

      const firstSaveItems = storage.get(STORAGE_KEY);
      assert.deepEqual(
        [
          {
            ...convo1a,
            wasOpened: true,
          },
          {
            ...convo1b,
            wasOpened: true,
          },
          convo2a,
        ],
        firstSaveItems
      );

      const convo2b = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-2',
        receivedAt: NOW + 16,
      };

      await placeholders.add(convo2b);
      assert.strictEqual(4, placeholders.getCount());
      await placeholders.findByConversationAndMarkOpened('conversation-id-2');
      assert.strictEqual(4, placeholders.getCount());

      const secondSaveItems = storage.get(STORAGE_KEY);
      assert.deepEqual(
        [
          {
            ...convo1a,
            wasOpened: true,
          },
          {
            ...convo1b,
            wasOpened: true,
          },
          {
            ...convo2a,
            wasOpened: true,
          },
          {
            ...convo2b,
            wasOpened: true,
          },
        ],
        secondSaveItems
      );
    });
  });

  describe('#findByMessageAndRemove', () => {
    it('does nothing if no item matching message found', async () => {
      const sentAt = NOW - 20;

      const older = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
        sentAt: NOW - 10,
      };
      const newer = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
        sentAt: NOW - 11,
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      assert.isUndefined(
        await placeholders.findByMessageAndRemove('conversation-id-1', sentAt)
      );
      assert.strictEqual(2, placeholders.getCount());
    });
    it('removes the item matching message', async () => {
      const sentAt = NOW - 20;

      const older = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
        sentAt: NOW - 10,
      };
      const newer = {
        ...getDefaultItem(),
        conversationId: 'conversation-id-1',
        sentAt,
      };
      const items: Array<RetryItemType> = [older, newer];
      await storage.put(STORAGE_KEY, items);

      const placeholders = new RetryPlaceholders();
      placeholders.start(storage);
      assert.strictEqual(2, placeholders.getCount());
      assert.deepEqual(
        newer,
        await placeholders.findByMessageAndRemove('conversation-id-1', sentAt)
      );
      assert.strictEqual(1, placeholders.getCount());
    });
  });
});
