// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';
import type { WritableDB } from '../../sql/Interface.std.js';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.js';

type MessageRow = Readonly<{
  type: 'incoming' | 'pinned-message-notification';
  id: string;
  sent_at: number;
  sourceServiceId: string | null;
  json: {
    pinnedMessageId?: string;
    pinMessage?: {
      targetAuthorAci: string;
      targetSentTimestamp: number;
    };
  };
}>;

describe('SQL/updateToSchemaVersion1630', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1620);
  });
  afterEach(() => {
    db.close();
  });

  function check(
    input: ReadonlyArray<MessageRow>,
    expected: ReadonlyArray<MessageRow>
  ) {
    insertData(db, 'messages', input);
    updateToVersion(db, 1630);

    const result = getTableData(db, 'messages').map(row => {
      return {
        id: row.id ?? null,
        type: row.type ?? null,
        sent_at: row.sent_at ?? null,
        sourceServiceId: row.sourceServiceId ?? null,
        json: row.json ?? null,
      } as MessageRow;
    });

    const actual = result.toSorted((a, b) => a.sent_at - b.sent_at);

    assert.deepStrictEqual(actual, expected);
  }

  it('replaces pinnedMessageId with pinMessage data', () => {
    const targetMessageId = '1-target';
    const targetAuthorAci = generateUuid();
    const targetSentTimestamp = 1000;

    const target: MessageRow = {
      id: targetMessageId,
      type: 'incoming',
      sent_at: targetSentTimestamp,
      sourceServiceId: targetAuthorAci,
      json: {},
    };

    const pinBefore: MessageRow = {
      id: '2-pin',
      type: 'pinned-message-notification',
      sent_at: 2000,
      sourceServiceId: null,
      json: { pinnedMessageId: targetMessageId },
    };

    const pinAfter: MessageRow = {
      id: '2-pin',
      type: 'pinned-message-notification',
      sent_at: 2000,
      sourceServiceId: null,
      json: {
        pinMessage: { targetAuthorAci, targetSentTimestamp },
      },
    };

    check([target, pinBefore], [target, pinAfter]);
  });

  it('drops the pinned message when target message sourceServiceId is null', () => {
    const targetMessageId = '1-target';

    const target: MessageRow = {
      id: targetMessageId,
      type: 'incoming',
      sent_at: 1000,
      sourceServiceId: null,
      json: {},
    };

    const pinBefore: MessageRow = {
      id: '2-pin',
      type: 'pinned-message-notification',
      sent_at: 2000,
      sourceServiceId: null,
      json: { pinnedMessageId: targetMessageId },
    };

    check([target, pinBefore], [target]); // dropped
  });

  it('drops the pinned message when target message sourceServiceId is not an aci', () => {
    const targetMessageId = '1-target';

    const target: MessageRow = {
      id: targetMessageId,
      type: 'incoming',
      sent_at: 1000,
      sourceServiceId: 'not-a-valid-aci',
      json: {},
    };

    const pinBefore: MessageRow = {
      id: '2-pin',
      type: 'pinned-message-notification',
      sent_at: 2000,
      sourceServiceId: null,
      json: { pinnedMessageId: targetMessageId },
    };

    check([target, pinBefore], [target]); // dropped
  });

  it('drops the pinned message when target message does not exist', () => {
    const pinBefore: MessageRow = {
      id: 'pin',
      type: 'pinned-message-notification',
      sent_at: 2000,
      sourceServiceId: null,
      json: { pinnedMessageId: 'TARGET_MESSAGE_DOES_NOT_EXIST' },
    };

    check([pinBefore], []);
  });

  it('drops the pinned message when it is missing a pinnedMessageId', () => {
    const pinBefore: MessageRow = {
      id: 'pin',
      type: 'pinned-message-notification',
      sent_at: 2000,
      sourceServiceId: null,
      json: {},
    };

    check([pinBefore], []);
  });
});
