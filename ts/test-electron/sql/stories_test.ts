// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { MessageAttributesType } from '../../model-types.d';

const { _getAllMessages, getAllStories } = DataReader;
const { removeAll, saveMessages } = DataWriter;

describe('sql/stories', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getAllStories', () => {
    it('returns N most recent stories overall, or in converation, or by author', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const sourceServiceId = generateAci();
      const ourAci = generateAci();

      const story1: MessageAttributesType = {
        id: generateUuid(),
        body: 'story 1',
        type: 'story',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        sourceServiceId: generateAci(),
      };
      const story2: MessageAttributesType = {
        id: generateUuid(),
        body: 'story 2',
        type: 'story',
        conversationId: generateUuid(),
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        sourceServiceId,
      };
      const story3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'incoming',
        conversationId: generateUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
        sourceServiceId,
      };
      const story4: MessageAttributesType = {
        id: generateUuid(),
        body: 'story 4',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        sourceServiceId: generateAci(),
      };
      const story5: MessageAttributesType = {
        id: generateUuid(),
        body: 'story 5',
        type: 'story',
        conversationId: generateUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
        sourceServiceId,
      };

      await saveMessages([story1, story2, story3, story4, story5], {
        forceSave: true,
        ourAci,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const stories = await getAllStories({});
      assert.lengthOf(stories, 4, 'expect four total stories');

      // They are in ASC order
      assert.strictEqual(
        stories[0].id,
        story1.id,
        'stories first should be story5'
      );
      assert.strictEqual(
        stories[3].id,
        story5.id,
        'stories last should be story1'
      );

      const storiesInConversation = await getAllStories({
        conversationId,
      });
      assert.lengthOf(
        storiesInConversation,
        2,
        'expect two stories in conversaton'
      );

      // They are in ASC order
      assert.strictEqual(
        storiesInConversation[0].id,
        story1.id,
        'storiesInConversation first should be story4'
      );
      assert.strictEqual(
        storiesInConversation[1].id,
        story4.id,
        'storiesInConversation last should be story1'
      );

      const storiesByAuthor = await getAllStories({
        sourceServiceId,
      });
      assert.lengthOf(storiesByAuthor, 2, 'expect two stories by author');

      // They are in ASC order
      assert.strictEqual(
        storiesByAuthor[0].id,
        story2.id,
        'storiesByAuthor first should be story5'
      );
      assert.strictEqual(
        storiesByAuthor[1].id,
        story5.id,
        'storiesByAuthor last should be story2'
      );
    });
  });
});
