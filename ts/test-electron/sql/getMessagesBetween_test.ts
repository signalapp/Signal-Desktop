// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { generateAci } from '../../types/ServiceId';
import { DataReader, DataWriter } from '../../sql/Client';

import type { MessageAttributesType } from '../../model-types';
import { postSaveUpdates } from '../../util/cleanup';

const { _getAllMessages, getMessagesBetween } = DataReader;
const { saveMessages, _removeAllMessages } = DataWriter;

describe('sql/getMessagesBetween', () => {
  beforeEach(async () => {
    await _removeAllMessages();
  });

  it('finds all messages between two in-order messages', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();

    function getMessage(body: string, offset: number): MessageAttributesType {
      return {
        id: generateUuid(),
        body,
        type: 'outgoing',
        conversationId,
        sent_at: now + offset,
        received_at: now + offset,
        timestamp: now + offset,
      };
    }

    const message1 = getMessage('message 1', -50);
    const message2 = getMessage('message 2', -40); // after
    const message3 = getMessage('message 3', -30);
    const message4 = getMessage('message 4', -20); // before
    const message5 = getMessage('message 5', -10);

    await saveMessages([message1, message2, message3, message4, message5], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    assert.lengthOf(await _getAllMessages(), 5);

    const ids = await getMessagesBetween(conversationId, {
      after: {
        received_at: message2.received_at,
        sent_at: message2.sent_at,
      },
      before: {
        received_at: message4.received_at,
        sent_at: message4.sent_at,
      },
      includeStoryReplies: false,
    });

    assert.lengthOf(ids, 1);
    assert.deepEqual(ids, [message3.id]);
  });

  it('returns based on timestamps even if one message doesnt exist', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();

    function getMessage(body: string, offset: number): MessageAttributesType {
      return {
        id: generateUuid(),
        body,
        type: 'outgoing',
        conversationId,
        sent_at: now + offset,
        received_at: now + offset,
        timestamp: now + offset,
      };
    }

    const message1 = getMessage('message 1', -50);
    const message2 = getMessage('message 2', -40); // after
    const message3 = getMessage('message 3', -30);
    const message4 = getMessage('message 4', -20); // before, doesn't exist
    const message5 = getMessage('message 5', -10);

    await saveMessages([message1, message2, message3, message5], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    assert.lengthOf(await _getAllMessages(), 4);

    const ids = await getMessagesBetween(conversationId, {
      after: {
        received_at: message2.received_at,
        sent_at: message2.sent_at,
      },
      before: {
        received_at: message4.received_at,
        sent_at: message4.sent_at,
      },
      includeStoryReplies: false,
    });

    assert.lengthOf(ids, 1);
    assert.deepEqual(ids, [message3.id]);
  });
});
