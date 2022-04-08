// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { MessageAttributesType } from '../../model-types.d';

const { removeAll, _getAllMessages, saveMessages, getOlderStories } =
  dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/stories', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getOlderStories', () => {
    it('returns N most recent stories overall, or in converation, or by author', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const sourceUuid = getUuid();
      const ourUuid = getUuid();

      const story1: MessageAttributesType = {
        id: getUuid(),
        body: 'story 1',
        type: 'story',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        sourceUuid: getUuid(),
      };
      const story2: MessageAttributesType = {
        id: getUuid(),
        body: 'story 2',
        type: 'story',
        conversationId: getUuid(),
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        sourceUuid,
      };
      const story3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'incoming',
        conversationId: getUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
        sourceUuid,
      };
      const story4: MessageAttributesType = {
        id: getUuid(),
        body: 'story 4',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        sourceUuid: getUuid(),
      };
      const story5: MessageAttributesType = {
        id: getUuid(),
        body: 'story 5',
        type: 'story',
        conversationId: getUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
        sourceUuid,
      };

      await saveMessages([story1, story2, story3, story4, story5], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const stories = await getOlderStories({
        limit: 5,
      });
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

      const storiesInConversation = await getOlderStories({
        conversationId,
        limit: 5,
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

      const storiesByAuthor = await getOlderStories({
        sourceUuid,
        limit: 5,
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

    it('returns N stories older than provided receivedAt/sentAt', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const start = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();

      const story1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'incoming',
        conversationId,
        sent_at: start - 2,
        received_at: start - 2,
        timestamp: start - 2,
      };
      const story2: MessageAttributesType = {
        id: getUuid(),
        body: 'story 2',
        type: 'story',
        conversationId,
        sent_at: start - 1,
        received_at: start - 1,
        timestamp: start - 1,
      };
      const story3: MessageAttributesType = {
        id: getUuid(),
        body: 'story 3',
        type: 'story',
        conversationId,
        sent_at: start - 1,
        received_at: start,
        timestamp: start,
      };
      const story4: MessageAttributesType = {
        id: getUuid(),
        body: 'story 4',
        type: 'story',
        conversationId,
        sent_at: start,
        received_at: start,
        timestamp: start,
      };
      const story5: MessageAttributesType = {
        id: getUuid(),
        body: 'story 5',
        type: 'story',
        conversationId,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
      };

      await saveMessages([story1, story2, story3, story4, story5], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const stories = await getOlderStories({
        receivedAt: story4.received_at,
        sentAt: story4.sent_at,
        limit: 5,
      });
      assert.lengthOf(stories, 2, 'expect two stories');

      // They are in ASC order
      assert.strictEqual(
        stories[0].id,
        story2.id,
        'stories first should be story3'
      );
      assert.strictEqual(
        stories[1].id,
        story3.id,
        'stories last should be story2'
      );
    });
  });
});
