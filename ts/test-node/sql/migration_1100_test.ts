// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Database } from '@signalapp/better-sqlite3';
import SQL from '@signalapp/better-sqlite3';
import { findLast } from 'lodash';
import { insertData, updateToVersion } from './helpers';
import { markAllCallHistoryReadSync } from '../../sql/Server';
import { SeenStatus } from '../../MessageSeenStatus';
import { CallMode } from '../../types/Calling';
import {
  CallDirection,
  CallType,
  DirectCallStatus,
} from '../../types/CallDisposition';
import { strictAssert } from '../../util/assert';

describe('SQL/updateToSchemaVersion1100', () => {
  let db: Database;
  beforeEach(() => {
    db = new SQL(':memory:');
    updateToVersion(db, 1100);
  });

  afterEach(() => {
    db.close();
  });

  describe('Optimize markAllCallHistoryReadInConversation', () => {
    it('is fast', () => {
      const COUNT = 10_000;

      const messages = Array.from({ length: COUNT }, (_, index) => {
        return {
          id: `test-message-${index}`,
          type: 'call-history',
          seenStatus: SeenStatus.Unseen,
          conversationId: `test-conversation-${index % 30}`,
          sent_at: index,
          json: {
            callId: `test-call-${index}`,
          },
        };
      });

      const callsHistory = Array.from({ length: COUNT }, (_, index) => {
        return {
          callId: `test-call-${index}`,
          peerId: `test-conversation-${index % 30}`,
          timestamp: index,
          ringerId: null,
          mode: CallMode.Direct,
          type: CallType.Video,
          direction: CallDirection.Incoming,
          status: DirectCallStatus.Missed,
        };
      });

      insertData(db, 'messages', messages);
      insertData(db, 'callsHistory', callsHistory);

      const latestCallInConversation = findLast(callsHistory, call => {
        return call.peerId === 'test-conversation-0';
      });

      strictAssert(latestCallInConversation, 'missing latest call');

      const target = {
        timestamp: latestCallInConversation.timestamp,
        callId: latestCallInConversation.callId,
        peerId: latestCallInConversation.peerId,
      };

      const start = performance.now();
      markAllCallHistoryReadSync(db, target, true);
      const end = performance.now();
      assert.isBelow(end - start, 50);
    });
  });
});
