// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { MessageAttributesType } from '../../model-types.d';
import { postSaveUpdates } from '../../util/cleanup';

const { _getAllMessages, getRecentStoryReplies } = DataReader;
const { removeAll, saveMessages } = DataWriter;

describe('sql/getRecentStoryReplies', () => {
  beforeEach(async () => {
    await removeAll();
  });

  it('returns message matching storyId in all converssations ', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId1 = generateUuid();
    const conversationId2 = generateUuid();
    const conversationId3 = generateUuid();
    const ourAci = generateAci();
    const storyId = generateUuid();
    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1 - reply #1',
      type: 'incoming',
      conversationId: conversationId1,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
      storyId,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2 - reply #2',
      type: 'incoming',
      conversationId: conversationId2,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
      storyId,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3 - reply #3',
      type: 'incoming',
      conversationId: conversationId3,
      sent_at: now,
      received_at: now,
      timestamp: now,
      storyId,
    };
    const message4: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4 - the story itself',
      type: 'story',
      conversationId: conversationId3,
      sent_at: now,
      received_at: now,
      timestamp: now,
      storyId,
    };
    const message5: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 5 - different story reply',
      type: 'incoming',
      conversationId: conversationId1,
      sent_at: now,
      received_at: now,
      timestamp: now,
      storyId: generateUuid(),
    };
    const message6: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 6 - no story fields',
      type: 'incoming',
      conversationId: conversationId1,
      sent_at: now,
      received_at: now,
      timestamp: now,
    };

    await saveMessages(
      [message1, message2, message3, message4, message5, message6],
      {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      }
    );

    assert.lengthOf(await _getAllMessages(), 6);

    const searchResultsPage1 = await getRecentStoryReplies(storyId, {
      limit: 2,
    });
    assert.lengthOf(searchResultsPage1, 2, 'page 1');
    assert.strictEqual(searchResultsPage1[0].body, message3.body);
    assert.strictEqual(searchResultsPage1[1].body, message2.body);

    const searchResultsPage2 = await getRecentStoryReplies(storyId, {
      messageId: message2.id,
      receivedAt: message2.received_at,
      limit: 2,
    });
    assert.lengthOf(searchResultsPage2, 1, 'page 2');
    assert.strictEqual(searchResultsPage2[0].body, message1.body);
  });
});
