// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v1 as getGuid } from 'uuid';

import { sql } from '../../sql/util.std.js';
import {
  updateToVersion,
  createDB,
  explain,
  insertData,
  getTableData,
} from './helpers.node.js';

import type { WritableDB } from '../../sql/Interface.std.js';

describe('SQL/updateToSchemaVersion1380', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1380);
  });

  afterEach(() => {
    db.close();
  });

  it('creates new donationReceipts table', () => {
    const [query] = sql`SELECT * FROM donationReceipts`;
    db.prepare(query).run();
  });

  it('throws if same id is used for an insert', () => {
    // Note: this kinda looks like a receipt, but the json field is weird because
    // insertData and getTableData both have special handling for JSON fields.
    const receipt = {
      id: getGuid(),
      currencyType: 'USD',
      paymentAmount: 500, // $5.00
      paymentType: 'CARD',
      paymentDetailJson: {
        lastFourDigits: '1111',
      },
      timestamp: Date.now(),
    };

    insertData(db, 'donationReceipts', [receipt]);

    assert.deepStrictEqual(getTableData(db, 'donationReceipts'), [receipt]);

    assert.throws(
      () => insertData(db, 'donationReceipts', [receipt]),
      /UNIQUE constraint/
    );
  });

  it('creates an index to make order by timestamp efficient', () => {
    const template = sql`
      SELECT * FROM donationReceipts
      ORDER BY timestamp DESC
      LIMIT 5
    `;

    const details = explain(db, template);
    assert.include(details, 'USING INDEX donationReceipts_byTimestamp');
    assert.notInclude(details, 'TEMP B-TREE');
  });
});
