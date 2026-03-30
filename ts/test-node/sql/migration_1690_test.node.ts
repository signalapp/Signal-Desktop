// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

describe('SQL/updateToSchemaVersion1690', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1680);
  });

  afterEach(() => {
    db.close();
  });

  it('migrates pollTerminateNotification.pollMessageId to pollTimestamp', () => {
    insertData(db, 'messages', [
      {
        id: 'poll-message',
        conversationId: 'conversation',
        type: 'incoming',
        timestamp: 12345,
        sent_at: 99999,
        json: { id: 'poll-message', poll: { question: 'question' } },
      },
      {
        id: 'terminate-legacy',
        conversationId: 'conversation',
        type: 'poll-terminate',
        json: {
          id: 'terminate-legacy',
          pollTerminateNotification: {
            question: 'question',
            pollMessageId: 'poll-message',
          },
        },
      },
      {
        id: 'terminate-missing-target',
        conversationId: 'conversation',
        type: 'poll-terminate',
        json: {
          id: 'terminate-missing-target',
          pollTerminateNotification: {
            question: 'question',
            pollMessageId: 'missing',
          },
        },
      },
      {
        id: 'terminate-without-id',
        conversationId: 'conversation',
        type: 'poll-terminate',
        json: {
          id: 'terminate-without-id',
          pollTerminateNotification: {
            question: 'question',
          },
        },
      },
      {
        id: 'terminate-without-notification',
        conversationId: 'conversation',
        type: 'poll-terminate',
        json: {
          id: 'terminate-without-notification',
        },
      },
    ]);

    updateToVersion(db, 1690);

    assert.sameDeepMembers(
      getTableData(db, 'messages').map(row => row.json),
      [
        {
          id: 'poll-message',
          poll: { question: 'question' },
        },
        {
          id: 'terminate-legacy',
          pollTerminateNotification: {
            question: 'question',
            pollTimestamp: 12345,
          },
        },
        {
          id: 'terminate-missing-target',
          pollTerminateNotification: {
            question: 'question',
            pollTimestamp: 0,
          },
        },
        {
          id: 'terminate-without-id',
          pollTerminateNotification: {
            question: 'question',
            pollTimestamp: 0,
          },
        },
        {
          id: 'terminate-without-notification',
        },
      ]
    );
  });
});
