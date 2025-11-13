// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface.std.js';
import { sql, sqlFragment } from '../../sql/util.std.js';
import { createDB, explain, updateToVersion } from './helpers.node.js';

describe('SQL/updateToSchemaVersion1540', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1540);
  });
  afterEach(() => {
    db.close();
  });

  const CORE_UPDATE_QUERY = sqlFragment`
    UPDATE messages
    INDEXED BY messages_conversationId_expirationStartTimestamp
    SET
        expirationStartTimestamp = 342342
    WHERE
        conversationId = 'conversationId' AND
        type IN ('incoming', 'poll-terminate') AND
        hasExpireTimer IS 1 AND
        received_at < 1304923
    `;

  const UPDATE_WHEN_NULL_START_QUERY = sqlFragment`
        ${CORE_UPDATE_QUERY} AND
        expirationStartTimestamp IS NULL
    `;
  const UPDATE_WHEN_LATE_START_QUERY = sqlFragment`
        ${CORE_UPDATE_QUERY} AND
        expirationStartTimestamp > 342342
    `;

  it('uses index efficiently with null start + storyId condition', () => {
    const detail = explain(
      db,
      sql`
        ${UPDATE_WHEN_NULL_START_QUERY} AND
          storyId is NULL
        `
    );

    assert.strictEqual(
      detail,
      'SEARCH messages USING INDEX messages_conversationId_expirationStartTimestamp' +
        ' (conversationId=? AND expirationStartTimestamp=?)'
    );
  });
  it('uses index efficiently with null start + no storyId condition', () => {
    const detail = explain(
      db,
      sql`
        ${UPDATE_WHEN_NULL_START_QUERY}
        `
    );

    assert.strictEqual(
      detail,
      'SEARCH messages USING INDEX messages_conversationId_expirationStartTimestamp' +
        ' (conversationId=? AND expirationStartTimestamp=?)'
    );
  });

  it('uses index efficiently with lateStart query and no storyId condition', () => {
    const detail = explain(db, sql`${UPDATE_WHEN_LATE_START_QUERY}`);

    assert.strictEqual(
      detail,
      'SEARCH messages USING INDEX messages_conversationId_expirationStartTimestamp' +
        ' (conversationId=? AND expirationStartTimestamp>?)'
    );
  });

  it('uses index efficiently with lateStart query and storyId condition', () => {
    const detail = explain(
      db,
      sql`${UPDATE_WHEN_LATE_START_QUERY} AND
          storyId is NULL`
    );

    assert.strictEqual(
      detail,
      'SEARCH messages USING INDEX messages_conversationId_expirationStartTimestamp' +
        ' (conversationId=? AND expirationStartTimestamp>?)'
    );
  });
});
