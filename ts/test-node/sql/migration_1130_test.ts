// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { WritableDB } from '../../sql/Interface.std.js';
import { sql } from '../../sql/util.std.js';
import { createDB, updateToVersion, explain } from './helpers.node.js';

describe('SQL/updateToSchemaVersion1130', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1130);
  });

  afterEach(() => {
    db.close();
  });

  it('uses new index for getAllStories query and no params', () => {
    const details = explain(
      db,
      sql`
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          (NULL IS NULL OR conversationId IS NULL) AND
          (NULL IS NULL OR sourceServiceId IS NULL)
        ORDER BY received_at ASC, sent_at ASC;
        `
    );

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses new index for getAllStories query and with conversationId', () => {
    const details = explain(
      db,
      sql`
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          ('something' IS NULL OR conversationId IS 'something') AND
          (NULL IS NULL OR sourceServiceId IS NULL)
        ORDER BY received_at ASC, sent_at ASC;
        `
    );

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses new index for getAllStories query and with sourceServiceId', () => {
    const details = explain(
      db,
      sql`
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          (NULL IS NULL OR conversationId IS NULL) AND
          ('something' IS NULL OR sourceServiceId IS 'something')
        ORDER BY received_at ASC, sent_at ASC;
        `
    );

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses new index for getAllStories query and both params', () => {
    const details = explain(
      db,
      sql`
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          ('something' IS NULL OR conversationId IS 'something') AND
          ('something' IS NULL OR sourceServiceId IS 'something')
        ORDER BY received_at ASC, sent_at ASC;
        `
    );

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses previous index for getAllStories get replies query', () => {
    const details = explain(
      db,
      sql`
        SELECT DISTINCT storyId
        FROM messages
        WHERE storyId IS NOT NULL
        `
    );

    assert.strictEqual(
      details,
      'SEARCH messages USING COVERING INDEX messages_by_storyId (storyId>?)'
    );
  });

  it('uses previous index for getAllStories get replies from self query', () => {
    const details = explain(
      db,
      sql`
        SELECT DISTINCT storyId
        FROM messages
        WHERE (
          storyId IS NOT NULL AND
          type IS 'outgoing'
        )
        `
    );

    assert.strictEqual(
      details,
      'SEARCH messages USING INDEX messages_by_storyId (storyId>?)'
    );
  });
});
