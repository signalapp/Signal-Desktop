// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion } from './helpers';

describe('SQL/updateToSchemaVersion1120', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1120);
  });

  afterEach(() => {
    db.close();
  });

  it('uses index for deleting edited messages', () => {
    const details = db
      .prepare(
        `EXPLAIN QUERY PLAN 
            DELETE FROM edited_messages WHERE messageId = 'messageId';
        `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(
      details,
      'SEARCH edited_messages USING COVERING INDEX edited_messages_messageId (messageId=?)'
    );
  });

  it('uses index for deleting mentions', () => {
    const details = db
      .prepare(
        `EXPLAIN QUERY PLAN 
            DELETE FROM mentions WHERE messageId = 'messageId';
          `
      )
      .all()
      .map(step => step.detail)
      .join(', ');

    assert.strictEqual(
      details,
      'SEARCH mentions USING COVERING INDEX mentions_messageId (messageId=?)'
    );
  });
});
