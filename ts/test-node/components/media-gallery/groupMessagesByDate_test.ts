// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { shuffle } from 'lodash';

import { IMAGE_JPEG } from '../../../types/MIME';
import type { Section } from '../../../components/conversation/media-gallery/groupMediaItemsByDate';
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
): Date => new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));

const toMediaItem = (date: Date): MediaItemType => ({
  objectURL: date.toUTCString(),
  index: 0,
  message: {
    conversationId: '1234',
    id: 'id',
    received_at: date.getTime(),
    received_at_ms: date.getTime(),
    attachments: [],
    sent_at: date.getTime(),
  },
  attachment: fakeAttachment({
    fileName: 'fileName',
    contentType: IMAGE_JPEG,
    url: 'url',
  }),
});

describe('groupMediaItemsByDate', () => {
  it('should group mediaItems', () => {
    const referenceTime = testDate(2018, 4, 12, 18, 0, 0).getTime(); // Thu
    const input: Array<MediaItemType> = shuffle([
      // Today
      toMediaItem(testDate(2018, 4, 12, 12, 0)), // Thu
      toMediaItem(testDate(2018, 4, 12, 0, 1)), // Thu
      // This week
      toMediaItem(testDate(2018, 4, 11, 23, 59)), // Wed
      toMediaItem(testDate(2018, 4, 9, 0, 1)), // Mon
      // This month
      toMediaItem(testDate(2018, 4, 8, 23, 59)), // Sun
      toMediaItem(testDate(2018, 4, 1, 0, 1)),
      // March 2018
      toMediaItem(testDate(2018, 3, 31, 23, 59)),
      toMediaItem(testDate(2018, 3, 1, 14, 0)),
      // February 2011
      toMediaItem(testDate(2011, 2, 28, 23, 59)),
      toMediaItem(testDate(2011, 2, 1, 10, 0)),
    ]);

    const expected: Array<Section> = [
      {
        type: 'today',
        mediaItems: [
          {
            objectURL: 'Thu, 12 Apr 2018 12:00:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1523534400000,
              received_at_ms: 1523534400000,
              attachments: [],
              sent_at: 1523534400000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
          {
            objectURL: 'Thu, 12 Apr 2018 00:01:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1523491260000,
              received_at_ms: 1523491260000,
              attachments: [],
              sent_at: 1523491260000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
        ],
      },
      {
        type: 'yesterday',
        mediaItems: [
          {
            objectURL: 'Wed, 11 Apr 2018 23:59:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1523491140000,
              received_at_ms: 1523491140000,
              attachments: [],
              sent_at: 1523491140000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
        ],
      },
      {
        type: 'thisWeek',
        mediaItems: [
          {
            objectURL: 'Mon, 09 Apr 2018 00:01:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1523232060000,
              received_at_ms: 1523232060000,
              attachments: [],
              sent_at: 1523232060000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
        ],
      },
      {
        type: 'thisMonth',
        mediaItems: [
          {
            objectURL: 'Sun, 08 Apr 2018 23:59:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1523231940000,
              received_at_ms: 1523231940000,
              attachments: [],
              sent_at: 1523231940000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
          {
            objectURL: 'Sun, 01 Apr 2018 00:01:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1522540860000,
              received_at_ms: 1522540860000,
              attachments: [],
              sent_at: 1522540860000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2018,
        month: 2,
        mediaItems: [
          {
            objectURL: 'Sat, 31 Mar 2018 23:59:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1522540740000,
              received_at_ms: 1522540740000,
              attachments: [],
              sent_at: 1522540740000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
          {
            objectURL: 'Thu, 01 Mar 2018 14:00:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1519912800000,
              received_at_ms: 1519912800000,
              attachments: [],
              sent_at: 1519912800000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2011,
        month: 1,
        mediaItems: [
          {
            objectURL: 'Mon, 28 Feb 2011 23:59:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1298937540000,
              received_at_ms: 1298937540000,
              attachments: [],
              sent_at: 1298937540000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
          {
            objectURL: 'Tue, 01 Feb 2011 10:00:00 GMT',
            index: 0,
            message: {
              conversationId: '1234',
              id: 'id',
              received_at: 1296554400000,
              received_at_ms: 1296554400000,
              attachments: [],
              sent_at: 1296554400000,
            },
            attachment: fakeAttachment({
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            }),
          },
        ],
      },
    ];

    const actual = groupMediaItemsByDate(referenceTime, input);
    assert.deepEqual(actual, expected);
  });
});
