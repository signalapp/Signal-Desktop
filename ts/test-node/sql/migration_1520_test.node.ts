// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { WritableDB } from '../../sql/Interface.std.js';
import { sql } from '../../sql/util.std.js';
import {
  createDB,
  updateToVersion,
  insertData,
  explain,
} from './helpers.node.js';

describe('SQL/updateToSchemaVersion1520', () => {
  let db: WritableDB;

  afterEach(() => {
    db.close();
  });

  describe('hasUnreadPollVotes column', () => {
    it('adds hasUnreadPollVotes column with default value 0', () => {
      db = createDB();
      updateToVersion(db, 1510);

      const messages = [
        {
          id: 'msg1',
          conversationId: 'conv1',
          type: 'outgoing',
          received_at: 1000,
          sent_at: 1000,
          timestamp: 1000,
          json: JSON.stringify({
            poll: { question: 'Test?' },
          }),
        },
      ];

      insertData(db, 'messages', messages);
      updateToVersion(db, 1520);

      const result = db
        .prepare("SELECT hasUnreadPollVotes FROM messages WHERE id = 'msg1'")
        .get<{ hasUnreadPollVotes: number }>();

      assert.strictEqual(result?.hasUnreadPollVotes, 0);
    });
  });

  describe('messages_unread_poll_votes index', () => {
    it('creates messages_unread_poll_votes index', () => {
      db = createDB();
      updateToVersion(db, 1520);

      const indexes = db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name = 'messages_unread_poll_votes'
      `
        )
        .all();

      assert.lengthOf(indexes, 1, 'index should exist');
    });

    it('uses index for getUnreadPollVotesAndMarkRead UPDATE query', () => {
      db = createDB();
      updateToVersion(db, 1520);

      const details = explain(
        db,
        sql`
          UPDATE messages
          INDEXED BY messages_unread_poll_votes
          SET hasUnreadPollVotes = 0
          WHERE
            conversationId = ${'test-conv'} AND
            hasUnreadPollVotes = 1 AND
            received_at <= ${5000} AND
            type IS 'outgoing'
          RETURNING id, conversationId, sent_at AS targetTimestamp, type;
        `
      );

      assert.strictEqual(
        details,
        'SEARCH messages USING COVERING INDEX messages_unread_poll_votes (conversationId=? AND received_at<?)'
      );
    });

    it('uses index when hasUnreadPollVotes = 1', () => {
      db = createDB();
      updateToVersion(db, 1520);

      const detailsWithIndex = explain(
        db,
        sql`
          SELECT id FROM messages
          WHERE
            conversationId = ${'test-conv'} AND
            hasUnreadPollVotes = 1 AND
            type IS 'outgoing' AND
            received_at <= ${5000};
        `
      );

      assert.include(
        detailsWithIndex,
        'messages_unread_poll_votes',
        'should use partial index when hasUnreadPollVotes = 1'
      );
    });

    it('index includes all required columns and conditions', () => {
      db = createDB();
      updateToVersion(db, 1520);

      const indexInfo = db
        .prepare(
          `
        SELECT sql FROM sqlite_master
        WHERE type = 'index' AND name = 'messages_unread_poll_votes'
      `
        )
        .get() as { sql: string };

      assert.include(indexInfo.sql, 'conversationId');
      assert.include(indexInfo.sql, 'received_at');
      assert.include(indexInfo.sql, 'WHERE hasUnreadPollVotes = 1');
      assert.include(indexInfo.sql, "type IS 'outgoing'");
    });
  });
});
