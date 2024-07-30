// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion } from './helpers';

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
    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN 
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          (NULL IS NULL OR conversationId IS NULL) AND
          (NULL IS NULL OR sourceServiceId IS NULL)
        ORDER BY received_at ASC, sent_at ASC;
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses new index for getAllStories query and with conversationId', () => {
    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN 
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          ('something' IS NULL OR conversationId IS 'something') AND
          (NULL IS NULL OR sourceServiceId IS NULL)
        ORDER BY received_at ASC, sent_at ASC;
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses new index for getAllStories query and with sourceServiceId', () => {
    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN 
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          (NULL IS NULL OR conversationId IS NULL) AND
          ('something' IS NULL OR sourceServiceId IS 'something')
        ORDER BY received_at ASC, sent_at ASC;
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses new index for getAllStories query and both params', () => {
    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN 
        SELECT json, id
        FROM messages
        WHERE
          isStory = 1 AND
          ('something' IS NULL OR conversationId IS 'something') AND
          ('something' IS NULL OR sourceServiceId IS 'something')
        ORDER BY received_at ASC, sent_at ASC;
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(details, 'SCAN messages USING INDEX messages_isStory');
  });

  it('uses previous index for getAllStories get replies query', () => {
    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        SELECT DISTINCT storyId
        FROM messages
        WHERE storyId IS NOT NULL
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(
      details,
      'SEARCH messages USING COVERING INDEX messages_by_storyId (storyId>?)'
    );
  });

  it('uses previous index for getAllStories get replies from self query', () => {
    const details = db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        SELECT DISTINCT storyId
        FROM messages
        WHERE (
          storyId IS NOT NULL AND
          type IS 'outgoing'
        )
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(
      details,
      'SEARCH messages USING INDEX messages_by_storyId (storyId>?)'
    );
  });
});
