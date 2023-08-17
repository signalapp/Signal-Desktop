import { assert } from 'chai';
import { shuffle } from 'lodash';

import { IMAGE_JPEG } from '../../../types/MIME';
import {
  groupMediaItemsByDate,
  Section,
} from '../../../components/conversation/media-gallery/groupMediaItemsByDate';
import { TestUtils } from '../../test-utils';
import { MediaItemType } from '../../../components/lightbox/LightboxGallery';

const generatedMessageSenderKey = TestUtils.generateFakePubKey().key;

const toMediaItem = (date: Date): MediaItemType => ({
  objectURL: date.toUTCString(),
  index: 0,
  attachment: {
    fileName: 'fileName',
    contentType: IMAGE_JPEG,
    url: 'url',
    fileSize: null,
    screenshot: null,
    thumbnail: null,
    path: '123456',
    id: 123456,
  },
  contentType: IMAGE_JPEG,
  messageSender: generatedMessageSenderKey,
  messageTimestamp: date.getTime(),
  messageId: '123456',
});

describe('groupMediaItemsByDate', () => {
  it('should group mediaItems', () => {
    const referenceTime = new Date('2018-04-12T18:00Z').getTime(); // Thu
    const input: Array<MediaItemType> = shuffle([
      // Today
      toMediaItem(new Date('2018-04-12T12:00Z')), // Thu
      toMediaItem(new Date('2018-04-12T00:01Z')), // Thu
      // This week
      toMediaItem(new Date('2018-04-11T23:59Z')), // Wed
      toMediaItem(new Date('2018-04-09T00:01Z')), // Mon
      // This month
      toMediaItem(new Date('2018-04-08T23:59Z')), // Sun
      toMediaItem(new Date('2018-04-01T00:01Z')),
      // March 2018
      toMediaItem(new Date('2018-03-31T23:59Z')),
      toMediaItem(new Date('2018-03-01T14:00Z')),
      // February 2011
      toMediaItem(new Date('2011-02-28T23:59Z')),
      toMediaItem(new Date('2011-02-01T10:00Z')),
    ]);

    const expected: Array<Section> = [
      {
        type: 'today',
        mediaItems: [
          {
            objectURL: 'Thu, 12 Apr 2018 12:00:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,

            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1523534400000,
            messageId: '123456',
          },
          {
            objectURL: 'Thu, 12 Apr 2018 00:01:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1523491260000,
            messageId: '123456',
          },
        ],
      },
      {
        type: 'yesterday',
        mediaItems: [
          {
            objectURL: 'Wed, 11 Apr 2018 23:59:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1523491140000,
            messageId: '123456',
          },
        ],
      },
      {
        type: 'thisWeek',
        mediaItems: [
          {
            objectURL: 'Mon, 09 Apr 2018 00:01:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1523232060000,
            messageId: '123456',
          },
        ],
      },
      {
        type: 'thisMonth',
        mediaItems: [
          {
            objectURL: 'Sun, 08 Apr 2018 23:59:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1523231940000,
            messageId: '123456',
          },
          {
            objectURL: 'Sun, 01 Apr 2018 00:01:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1522540860000,
            messageId: '123456',
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
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1522540740000,
            messageId: '123456',
          },
          {
            objectURL: 'Thu, 01 Mar 2018 14:00:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1519912800000,
            messageId: '123456',
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
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            contentType: IMAGE_JPEG,
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1298937540000,
            messageId: '123456',
          },
          {
            objectURL: 'Tue, 01 Feb 2011 10:00:00 GMT',
            index: 0,
            contentType: IMAGE_JPEG,
            messageSender: generatedMessageSenderKey,
            messageTimestamp: 1296554400000,
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
              fileSize: null,
              screenshot: null,
              thumbnail: null,
              path: '123456',
              id: 123456,
            },
            messageId: '123456',
          },
        ],
      },
    ];

    const actual = groupMediaItemsByDate(referenceTime, input);
    assert.deepEqual(actual, expected);
  });
});
