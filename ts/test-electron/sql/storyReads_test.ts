// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { StoryReadType } from '../../sql/Interface';

const {
  _getAllStoryReads,
  _deleteAllStoryReads,
  addNewStoryRead,
  getLastStoryReadsForAuthor,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/storyReads', () => {
  beforeEach(async () => {
    await _deleteAllStoryReads();
  });

  it('roundtrips with create/fetch/delete', async () => {
    assert.lengthOf(await _getAllStoryReads(), 0);

    const read: StoryReadType = {
      authorId: getUuid(),
      conversationId: getUuid(),
      storyId: getUuid(),
      storyReadDate: Date.now(),
    };

    await addNewStoryRead(read);

    const allReads = await _getAllStoryReads();
    assert.lengthOf(allReads, 1);
    assert.deepEqual(allReads[0], read);
  });

  describe('getLastStoryReadsForAuthor', () => {
    it('returns n = limit items for author', async () => {
      const now = Date.now();
      const authorId = getUuid();
      const read1: StoryReadType = {
        authorId,
        conversationId: getUuid(),
        storyId: getUuid(),
        storyReadDate: now - 20,
      };
      const read2: StoryReadType = {
        authorId,
        conversationId: getUuid(),
        storyId: getUuid(),
        storyReadDate: now - 10,
      };
      const read3: StoryReadType = {
        authorId,
        conversationId: getUuid(),
        storyId: getUuid(),
        storyReadDate: now,
      };
      const read4: StoryReadType = {
        authorId: getUuid(),
        conversationId: getUuid(),
        storyId: getUuid(),
        storyReadDate: now,
      };

      await addNewStoryRead(read1);
      await addNewStoryRead(read2);
      await addNewStoryRead(read3);
      await addNewStoryRead(read4);

      assert.lengthOf(await _getAllStoryReads(), 4);

      const lastReads = await getLastStoryReadsForAuthor({
        authorId,
        limit: 2,
      });
      assert.lengthOf(lastReads, 2);
      assert.deepEqual([read3, read2], lastReads);
    });

    it('returns only items in provided conversation', async () => {
      const now = Date.now();
      const authorId = getUuid();
      const conversationId = getUuid();
      const read1: StoryReadType = {
        authorId,
        conversationId,
        storyId: getUuid(),
        storyReadDate: now - 20,
      };
      const read2: StoryReadType = {
        authorId,
        conversationId,
        storyId: getUuid(),
        storyReadDate: now - 10,
      };
      const read3: StoryReadType = {
        authorId,
        conversationId: getUuid(),
        storyId: getUuid(),
        storyReadDate: now,
      };
      const read4: StoryReadType = {
        authorId,
        conversationId: getUuid(),
        storyId: getUuid(),
        storyReadDate: now,
      };

      await addNewStoryRead(read1);
      await addNewStoryRead(read2);
      await addNewStoryRead(read3);
      await addNewStoryRead(read4);

      assert.lengthOf(await _getAllStoryReads(), 4);

      const lastReads = await getLastStoryReadsForAuthor({
        authorId,
        conversationId,
        limit: 1,
      });
      assert.lengthOf(lastReads, 1);
      assert.deepEqual([read2], lastReads);
    });
  });
});
