// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import type { WritableDB } from '../../../sql/Interface.std.js';
import { setupTests } from '../../../sql/Server.node.js';
import type { AppendPinnedMessageResult } from '../../../sql/server/pinnedMessages.std.ts';
import {
  appendPinnedMessage,
  deletePinnedMessageByMessageId,
  getNextExpiringPinnedMessageAcrossConversations,
  deleteAllExpiredPinnedMessagesBefore,
} from '../../../sql/server/pinnedMessages.std.js';
import { createDB, insertData } from '../helpers.node.js';
import type {
  PinnedMessage,
  PinnedMessageParams,
} from '../../../types/PinnedMessage.std.js';

function setupData(db: WritableDB) {
  insertData(db, 'conversations', [{ id: 'c1' }, { id: 'c2' }]);
  insertData(db, 'messages', [
    // conversation: c1
    { id: 'c1-m1', conversationId: 'c1' },
    { id: 'c1-m2', conversationId: 'c1' },
    { id: 'c1-m3', conversationId: 'c1' },
    { id: 'c1-m4', conversationId: 'c1' },
    // conversation: c2
    { id: 'c2-m1', conversationId: 'c2' },
    { id: 'c2-m2', conversationId: 'c2' },
  ]);
}

function getParams(
  conversationId: string,
  messageId: string,
  pinnedAt: number,
  expiresAt: number | null = null
): PinnedMessageParams {
  return {
    messageId,
    conversationId,
    pinnedAt,
    expiresAt,
  };
}

describe('sql/server/pinnedMessages', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    setupTests(db);
    setupData(db);
  });

  afterEach(() => {
    db.close();
  });

  function assertRows(expected: ReadonlyArray<PinnedMessage>) {
    const rows = db.prepare('SELECT * FROM pinnedMessages').all();
    assert.deepEqual(rows, expected);
  }

  function expectInserted(result: AppendPinnedMessageResult): PinnedMessage {
    const inserted = result.change?.inserted;
    assert(inserted != null, 'Append should have inserted a row');
    return inserted;
  }

  describe('appendPinnedMessage', () => {
    it('insert new pinned message', () => {
      const params = getParams('c1', 'c1-m1', 1);
      const result = appendPinnedMessage(db, 3, params);
      const row = expectInserted(result);
      assertRows([row]);

      assert.deepEqual(result, {
        change: {
          inserted: { id: 1, ...params },
          replaced: null,
        },
        truncated: [],
      });
    });

    it('replace existing pinned message', () => {
      const initial = getParams('c1', 'c1-m1', 1);
      const updated = getParams('c1', 'c1-m1', 2);

      appendPinnedMessage(db, 3, initial);
      const result = appendPinnedMessage(db, 3, updated);
      const row = expectInserted(result);
      assertRows([row]);

      assert.deepEqual(result, {
        change: {
          inserted: { id: 2, ...updated },
          replaced: 1,
        },
        truncated: [],
      });
    });

    it('truncates pinned messages to limit', () => {
      const pin1 = getParams('c1', 'c1-m1', 1);
      const pin2 = getParams('c1', 'c1-m2', 2);
      const pin3 = getParams('c1', 'c1-m3', 3);
      const pin4 = getParams('c1', 'c1-m4', 4);

      const row1 = expectInserted(appendPinnedMessage(db, 3, pin1));
      const row2 = expectInserted(appendPinnedMessage(db, 3, pin2));
      const row3 = expectInserted(appendPinnedMessage(db, 3, pin3));
      assertRows([row1, row2, row3]);

      const result = appendPinnedMessage(db, 3, pin4);
      const row4 = expectInserted(result);

      assertRows([row2, row3, row4]);

      assert.deepEqual(result, {
        change: {
          inserted: { id: 4, ...pin4 },
          replaced: null,
        },
        truncated: [1],
      });
    });

    it('doesnt truncate on top of replacing existing', () => {
      const pin1 = getParams('c1', 'c1-m1', 1);
      const pin2 = getParams('c1', 'c1-m2', 2);
      const pin3 = getParams('c1', 'c1-m3', 3);
      const updated = { ...pin3, pinnedAt: 4 };

      const row1 = expectInserted(appendPinnedMessage(db, 3, pin1));
      const row2 = expectInserted(appendPinnedMessage(db, 3, pin2));
      const row3 = expectInserted(appendPinnedMessage(db, 3, pin3));
      assertRows([row1, row2, row3]);

      const result = appendPinnedMessage(db, 3, updated);
      const row4 = expectInserted(result);
      assertRows([row1, row2, row4]);

      assert.deepEqual(result, {
        change: {
          inserted: { id: 4, ...updated },
          replaced: 3,
        },
        truncated: [],
      });
    });

    it('truncates multiple past limit', () => {
      const pin1 = getParams('c1', 'c1-m1', 1);
      const pin2 = getParams('c1', 'c1-m2', 2);
      const pin3 = getParams('c1', 'c1-m3', 3);
      const pin4 = getParams('c1', 'c1-m4', 4);

      let limit = 3;

      const row1 = expectInserted(appendPinnedMessage(db, limit, pin1));
      const row2 = expectInserted(appendPinnedMessage(db, limit, pin2));
      const row3 = expectInserted(appendPinnedMessage(db, limit, pin3));
      assertRows([row1, row2, row3]);

      limit = 2;

      const result = appendPinnedMessage(db, limit, pin4);
      const row4 = expectInserted(result);
      assertRows([row3, row4]);

      assert.deepEqual(result, {
        change: {
          inserted: { id: 4, ...pin4 },
          replaced: null,
        },
        truncated: [1, 2],
      });
    });

    it('truncates based on pinnedAt (not insert order) to handle out-of-order messages', () => {
      const pin1 = getParams('c1', 'c1-m1', 1);
      const pin2 = getParams('c1', 'c1-m2', 2);
      const pin3 = getParams('c1', 'c1-m3', 3);
      const pin4 = getParams('c1', 'c1-m4', 3);

      const row2 = expectInserted(appendPinnedMessage(db, 3, pin2));
      const row3 = expectInserted(appendPinnedMessage(db, 3, pin3));
      const row4 = expectInserted(appendPinnedMessage(db, 3, pin4));
      const result = appendPinnedMessage(db, 3, pin1);
      assertRows([row2, row3, row4]);

      assert.deepEqual(result, {
        change: {
          // Note: New row was immediately truncated
          inserted: { id: 4, ...pin1 },
          replaced: null,
        },
        truncated: [4],
      });
    });

    it('should only truncate for the same conversation', () => {
      const pin1 = getParams('c1', 'c1-m1', 1);
      const pin2 = getParams('c1', 'c1-m2', 2);
      const pin3 = getParams('c1', 'c1-m3', 3);
      const pin4 = getParams('c2', 'c2-m1', 4); // other chat

      const row1 = expectInserted(appendPinnedMessage(db, 3, pin2));
      const row2 = expectInserted(appendPinnedMessage(db, 3, pin3));
      const row3 = expectInserted(appendPinnedMessage(db, 3, pin4));
      const result = appendPinnedMessage(db, 3, pin1);
      const row4 = expectInserted(result);
      assertRows([row1, row2, row3, row4]);

      assert.deepEqual(result, {
        change: {
          inserted: { id: 4, ...pin1 },
          replaced: null,
        },
        truncated: [],
      });
    });
  });

  describe('deletePinnedMessageByMessageId', () => {
    it('should return null if theres no matching pinned message', () => {
      const result = deletePinnedMessageByMessageId(db, 'c1-m1');
      assert.equal(result, null);
    });

    it('should return the deleted pinned message id', () => {
      appendPinnedMessage(db, 3, getParams('c1', 'c1-m1', 1));
      const result = deletePinnedMessageByMessageId(db, 'c1-m1');
      assert.equal(result, 1);
    });
  });

  describe('getNextExpiringPinnedMessageAcrossConversations', () => {
    it('should return null if theres no pinned messages', () => {
      const result = getNextExpiringPinnedMessageAcrossConversations(db);
      assert.equal(result, null);
    });

    it('should return null if the pinned messages have no expiration', () => {
      appendPinnedMessage(db, 3, getParams('c1', 'c1-m1', 1, null));
      const result = getNextExpiringPinnedMessageAcrossConversations(db);
      assert.equal(result, null);
    });

    it('should return the pinned message with the earliest expiration date', () => {
      const pin1 = getParams('c1', 'c1-m1', 1, 4);
      const pin2 = getParams('c1', 'c1-m1', 2, 3);
      const pin3 = getParams('c2', 'c2-m1', 3, 2);
      const pin4 = getParams('c2', 'c2-m2', 4, 1); // expires next

      appendPinnedMessage(db, 3, pin1);
      appendPinnedMessage(db, 3, pin2);
      appendPinnedMessage(db, 3, pin3);
      appendPinnedMessage(db, 3, pin4);

      const result = getNextExpiringPinnedMessageAcrossConversations(db);
      assert.deepEqual(result, {
        id: 4,
        ...pin4,
      });
    });
  });

  describe('deleteAllExpiredPinnedMessagesBefore', () => {
    function insertPin(params: PinnedMessageParams) {
      return expectInserted(appendPinnedMessage(db, 3, params));
    }

    it('should return an empty array if theres no pinned messages', () => {
      const result = deleteAllExpiredPinnedMessagesBefore(db, 1);
      assert.deepEqual(result, []);
    });

    it('should not delete pinned messages that have no expiration', () => {
      const row = insertPin(getParams('c1', 'c1-m1', 1, null)); // no expiration
      const result = deleteAllExpiredPinnedMessagesBefore(db, 1);
      assertRows([row]);
      assert.deepEqual(result, []);
    });

    it('should not delete pinned messages that have not expired yet ', () => {
      const row = insertPin(getParams('c1', 'c1-m1', 1, 2)); // not expired yet
      const result = deleteAllExpiredPinnedMessagesBefore(db, 1);
      assertRows([row]);
      assert.deepEqual(result, []);
    });

    it('should delete pinned messages that have expired', () => {
      const row1 = insertPin(getParams('c1', 'c1-m1', 1, 1)); // expired
      const row2 = insertPin(getParams('c1', 'c1-m2', 2, 2)); // expired
      const row3 = insertPin(getParams('c1', 'c1-m3', 3, 3)); // not expired yet
      const result = deleteAllExpiredPinnedMessagesBefore(db, 2);
      assertRows([row3]);
      assert.deepEqual(result, [row1.id, row2.id]);
    });
  });
});
