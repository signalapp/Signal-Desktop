// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { StoryReadType } from '../../sql/Interface';

const { _getAllStoryReads, getLastStoryReadsForAuthor } = DataReader;

const { _deleteAllStoryReads, addNewStoryRead } = DataWriter;

describe('sql/storyReads', () => {
  beforeEach(async () => {
    await _deleteAllStoryReads();
  });

  it('roundtrips with create/fetch/delete', async () => {
    assert.lengthOf(await _getAllStoryReads(), 0);

    const read: StoryReadType = {
      authorId: generateAci(),
      conversationId: generateUuid(),
      storyId: generateUuid(),
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
      const authorId = generateAci();
      const read1: StoryReadType = {
        authorId,
        conversationId: generateUuid(),
        storyId: generateUuid(),
        storyReadDate: now - 20,
      };
      const read2: StoryReadType = {
        authorId,
        conversationId: generateUuid(),
        storyId: generateUuid(),
        storyReadDate: now - 10,
      };
      const read3: StoryReadType = {
        authorId,
        conversationId: generateUuid(),
        storyId: generateUuid(),
        storyReadDate: now,
      };
      const read4: StoryReadType = {
        authorId: generateAci(),
        conversationId: generateUuid(),
        storyId: generateUuid(),
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
      const authorId = generateAci();
      const conversationId = generateUuid();
      const read1: StoryReadType = {
        authorId,
        conversationId,
        storyId: generateUuid(),
        storyReadDate: now - 20,
      };
      const read2: StoryReadType = {
        authorId,
        conversationId,
        storyId: generateUuid(),
        storyReadDate: now - 10,
      };
      const read3: StoryReadType = {
        authorId,
        conversationId: generateUuid(),
        storyId: generateUuid(),
        storyReadDate: now,
      };
      const read4: StoryReadType = {
        authorId,
        conversationId: generateUuid(),
        storyId: generateUuid(),
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
