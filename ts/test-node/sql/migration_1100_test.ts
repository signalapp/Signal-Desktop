// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { findLast } from 'lodash';
import type { WritableDB } from '../../sql/Interface';
import { markAllCallHistoryRead } from '../../sql/Server';
import { SeenStatus } from '../../MessageSeenStatus';
import {
  CallMode,
  CallDirection,
  CallType,
  DirectCallStatus,
} from '../../types/CallDisposition';
import { strictAssert } from '../../util/assert';
import { createDB, insertData, updateToVersion } from './helpers';

describe('SQL/updateToSchemaVersion1100', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    // index updated in 1170
    // columns updated in 1210
    updateToVersion(db, 1210);
  });

  afterEach(() => {
    db.close();
  });

  describe('Optimize markAllCallHistoryReadInConversation', () => {
    it('is fast', () => {
      const COUNT = 10_000;
      const CONVERSATIONS = 30;

      const conversations = Array.from(
        { length: CONVERSATIONS },
        (_, index) => {
          return {
            id: `test-conversation-${index}`,
            groupId: `test-conversation-${index}`,
            serviceId: `test-conversation-${index}`,
          };
        }
      );

      const messages = Array.from({ length: COUNT }, (_, index) => {
        return {
          id: `test-message-${index}`,
          type: 'call-history',
          seenStatus: SeenStatus.Unseen,
          conversationId: `test-conversation-${index % CONVERSATIONS}`,
          received_at: index,
          json: {
            callId: `test-call-${index}`,
          },
        };
      });

      const callsHistory = Array.from({ length: COUNT }, (_, index) => {
        return {
          callId: `test-call-${index}`,
          peerId: `test-conversation-${index % CONVERSATIONS}`,
          timestamp: index,
          ringerId: null,
          mode: CallMode.Direct,
          type: CallType.Video,
          direction: CallDirection.Incoming,
          status: DirectCallStatus.Missed,
        };
      });

      insertData(db, 'conversations', conversations);
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
      const changes = markAllCallHistoryRead(db, target, true);
      const end = performance.now();
      assert.equal(changes, Math.ceil(COUNT / CONVERSATIONS));
      assert.isBelow(end - start, 50);
    });
  });
});
