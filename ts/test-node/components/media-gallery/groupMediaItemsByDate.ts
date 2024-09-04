// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { shuffle } from 'lodash';

import { IMAGE_JPEG } from '../../../types/MIME';
import { groupMediaItemsByDate } from '../../../components/conversation/media-gallery/groupMediaItemsByDate';
import type { MediaItemType } from '../../../types/MediaItem';
import { fakeAttachment } from '../../../test-both/helpers/fakeAttachment';

const testDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date => new Date(year, month - 1, day, hour, minute, second, 0);

const toMediaItem = (id: string, date: Date): MediaItemType => {
  return {
    objectURL: id,
    index: 0,
    message: {
      conversationId: '1234',
      id: 'id',
      receivedAt: date.getTime(),
      receivedAtMs: date.getTime(),
      attachments: [],
      sentAt: date.getTime(),
    },
    attachment: fakeAttachment({
      fileName: 'fileName',
      contentType: IMAGE_JPEG,
      url: 'url',
    }),
  };
};

describe('groupMediaItemsByDate', () => {
  it('should group mediaItems', () => {
    const referenceTime = testDate(2024, 4, 12, 18, 0, 0).getTime(); // Friday
    const input: Array<MediaItemType> = shuffle([
      toMediaItem('today-1', testDate(2024, 4, 12, 17, 59)), // Friday, one minute ago
      toMediaItem('today-2', testDate(2024, 4, 12, 0, 1)), // Friday early morning
      toMediaItem('yesterday-1', testDate(2024, 4, 11, 18, 0)), // Thursday
      toMediaItem('yesterday-2', testDate(2024, 4, 11, 0, 1)), // Thursday early morning
      toMediaItem('thisWeek-1', testDate(2024, 4, 10, 18, 0)), // Wednesday
      toMediaItem('thisWeek-2', testDate(2024, 4, 8, 18, 0)), // Monday
      toMediaItem('thisWeek-3', testDate(2024, 4, 5, 18, 0)), // Last Friday
      toMediaItem('thisWeek-4', testDate(2024, 4, 5, 0, 1)), // Last Friday early morning
      toMediaItem('thisMonth-1', testDate(2024, 4, 2, 18, 0)), // Second day of moth
      toMediaItem('thisMonth-2', testDate(2024, 4, 1, 18, 0)), // First day of month
      toMediaItem('mar2024-1', testDate(2024, 3, 31, 23, 59)),
      toMediaItem('mar2024-2', testDate(2024, 3, 1, 0, 1)),
      toMediaItem('feb2011-1', testDate(2011, 2, 28, 23, 59)),
      toMediaItem('feb2011-2', testDate(2011, 2, 1, 0, 1)),
    ]);

    const actual = groupMediaItemsByDate(referenceTime, input);

    assert.strictEqual(actual[0].type, 'today');
    assert.strictEqual(actual[0].mediaItems.length, 2, 'today');
    assert.strictEqual(actual[0].mediaItems[0].objectURL, 'today-1');
    assert.strictEqual(actual[0].mediaItems[1].objectURL, 'today-2');

    assert.strictEqual(actual[1].type, 'yesterday');
    assert.strictEqual(actual[1].mediaItems.length, 2, 'yesterday');
    assert.strictEqual(actual[1].mediaItems[0].objectURL, 'yesterday-1');
    assert.strictEqual(actual[1].mediaItems[1].objectURL, 'yesterday-2');

    assert.strictEqual(actual[2].type, 'thisWeek');
    assert.strictEqual(actual[2].mediaItems.length, 4, 'thisWeek');
    assert.strictEqual(actual[2].mediaItems[0].objectURL, 'thisWeek-1');
    assert.strictEqual(actual[2].mediaItems[1].objectURL, 'thisWeek-2');
    assert.strictEqual(actual[2].mediaItems[2].objectURL, 'thisWeek-3');
    assert.strictEqual(actual[2].mediaItems[3].objectURL, 'thisWeek-4');

    assert.strictEqual(actual[3].type, 'thisMonth');
    assert.strictEqual(actual[3].mediaItems.length, 2, 'thisMonth');
    assert.strictEqual(actual[3].mediaItems[0].objectURL, 'thisMonth-1');
    assert.strictEqual(actual[3].mediaItems[1].objectURL, 'thisMonth-2');

    assert.strictEqual(actual[4].type, 'yearMonth');
    assert.strictEqual(actual[4].mediaItems.length, 2, 'mar2024');
    assert.strictEqual(actual[4].mediaItems[0].objectURL, 'mar2024-1');
    assert.strictEqual(actual[4].mediaItems[1].objectURL, 'mar2024-2');

    assert.strictEqual(actual[5].type, 'yearMonth');
    assert.strictEqual(actual[5].mediaItems.length, 2, 'feb2011');
    assert.strictEqual(actual[5].mediaItems[0].objectURL, 'feb2011-1');
    assert.strictEqual(actual[5].mediaItems[1].objectURL, 'feb2011-2');

    assert.strictEqual(actual.length, 6, 'total sections');
  });
});
