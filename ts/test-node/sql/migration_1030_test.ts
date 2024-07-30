// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';
import { sql } from '../../sql/util';
import { createDB, updateToVersion } from './helpers';
import type { WritableDB, MessageType } from '../../sql/Interface';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent';

describe('SQL/updateToSchemaVersion1030', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1020);
  });

  afterEach(() => {
    db.close();
  });

  function createMessage(
    attrs: Pick<MessageType, 'type' | 'messageRequestResponseEvent'>
  ): MessageType {
    const message: MessageType = {
      id: generateGuid(),
      conversationId: generateGuid(),
      received_at: Date.now(),
      sent_at: Date.now(),
      received_at_ms: Date.now(),
      timestamp: Date.now(),
      ...attrs,
    };
    const json = JSON.stringify(message);
    const [query, params] = sql`
      INSERT INTO messages
        (id, conversationId, type, json)
      VALUES
        (
          ${message.id},
          ${message.conversationId},
          ${message.type},
          ${json}
        )
    `;
    db.prepare(query).run(params);
    return message;
  }

  function getMessages() {
    const [query] = sql`
      SELECT type, json_extract(json, '$.messageRequestResponseEvent') AS event, shouldAffectActivity, shouldAffectPreview FROM messages;
    `;
    return db.prepare(query).all();
  }

  const INCLUDED_TYPES = [
    'call-history',
    'chat-session-refreshed',
    'delivery-issue',
    'group-v2-change',
    'group',
    'incoming',
    'outgoing',
    'phone-number-discovery',
    'timer-notification',
    'title-transition-notification',
  ] as const;

  const EXCLUDED_TYPES = [
    'change-number-notification',
    'contact-removed-notification',
    'conversation-merge',
    'group-v1-migration',
    'keychange',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy type
    'message-history-unsynced' as any,
    'profile-change',
    'story',
    'universal-timer-notification',
    'verified-change',
  ] as const;

  it('marks activity and preview correctly', () => {
    for (const type of [...INCLUDED_TYPES, ...EXCLUDED_TYPES]) {
      createMessage({
        type,
      });
    }

    createMessage({
      type: 'message-request-response-event',
      messageRequestResponseEvent: MessageRequestResponseEvent.ACCEPT,
    });
    createMessage({
      type: 'message-request-response-event',
      messageRequestResponseEvent: MessageRequestResponseEvent.BLOCK,
    });
    createMessage({
      type: 'message-request-response-event',
      messageRequestResponseEvent: MessageRequestResponseEvent.UNBLOCK,
    });
    createMessage({
      type: 'message-request-response-event',
      messageRequestResponseEvent: MessageRequestResponseEvent.SPAM,
    });

    updateToVersion(db, 1030);

    const messages = getMessages();

    assert.deepStrictEqual(messages, [
      ...INCLUDED_TYPES.map(type => {
        return {
          type,
          event: null,
          shouldAffectActivity: 1,
          shouldAffectPreview: 1,
        };
      }),
      ...EXCLUDED_TYPES.map(type => {
        return {
          type,
          event: null,
          shouldAffectActivity: 0,
          shouldAffectPreview: 0,
        };
      }),
      {
        type: 'message-request-response-event',
        event: MessageRequestResponseEvent.ACCEPT,
        shouldAffectActivity: 0,
        shouldAffectPreview: 0,
      },
      {
        type: 'message-request-response-event',
        event: MessageRequestResponseEvent.BLOCK,
        shouldAffectActivity: 0,
        shouldAffectPreview: 0,
      },
      {
        type: 'message-request-response-event',
        event: MessageRequestResponseEvent.UNBLOCK,
        shouldAffectActivity: 0,
        shouldAffectPreview: 0,
      },
      {
        type: 'message-request-response-event',
        event: MessageRequestResponseEvent.SPAM,
        shouldAffectActivity: 1,
        shouldAffectPreview: 1,
      },
    ]);
  });
});
