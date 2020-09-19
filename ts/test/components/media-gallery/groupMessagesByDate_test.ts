import { assert } from 'chai';
import { shuffle } from 'lodash';

import { IMAGE_JPEG } from '../../../types/MIME';
import {
  groupMediaItemsByDate,
  Section,
} from '../../../components/conversation/media-gallery/groupMediaItemsByDate';
import { MediaItemType } from '../../../components/LightboxGallery';

const toMediaItem = (date: Date): MediaItemType => ({
  objectURL: date.toUTCString(),
  thumbnailObjectUrl: date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
  }),
  index: 0,
  message: {
    id: 'id',
    received_at: date.getTime(),
    attachments: [],
  },
  attachment: {
    fileName: 'fileName',
    contentType: IMAGE_JPEG,
    url: 'url',
  },
});

describe('groupMediaItemsByDate', () => {
  it('should group mediaItems', () => {
    const referenceTime = new Date('2018-04-12T18:00Z').getTime(); // Thu
    const input: Array<MediaItemType> = shuffle([
      // Today in eastern tz
      toMediaItem(new Date('2018-04-12T12:00:00.000Z')), // Thu GMT
      toMediaItem(new Date('2018-04-12T04:00:00.000Z')), // Thu GMT
      // Yesterday in eastern tz
      toMediaItem(new Date('2018-04-12T03:59:59.999Z')), // Thu GMT
      toMediaItem(new Date('2018-04-11T04:00:00.000Z')), // Wed GMT
      // This week in eastern tz
      toMediaItem(new Date('2018-04-11T03:59:59.999Z')), // Wed GMT
      toMediaItem(new Date('2018-04-10T10:32Z')), // Wed GMT
      toMediaItem(new Date('2018-04-09T04:00:00.000Z')), // Mon GMT
      // This month
      toMediaItem(new Date('2018-04-09T03:59:59.999Z')), // Mon GMT
      toMediaItem(new Date('2018-04-08T23:59:00.000Z')), // Sun
      toMediaItem(new Date('2018-04-01T04:00:00.000Z')),
      // March 2018
      toMediaItem(new Date('2018-04-01T03:59:59.999Z')),
      toMediaItem(new Date('2018-03-31T23:59Z')),
      // DST starts on the 11th of March in 2018 +5 becomes +4 for est
      toMediaItem(new Date('2018-03-01T05:00:00.000Z')),

      // May 2017 in eastern tz
      toMediaItem(new Date('2017-05-01T04:00Z')),
      // April 2017 in eastern tz
      toMediaItem(new Date('2017-05-01T03:59Z')),
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
            thumbnailObjectUrl: '4/12/2018, 8:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523534400000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Thu, 12 Apr 2018 04:00:00 GMT',
            thumbnailObjectUrl: '4/12/2018, 12:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523505600000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
      {
        type: 'yesterday',
        mediaItems: [
          {
            objectURL: 'Thu, 12 Apr 2018 03:59:59 GMT',
            thumbnailObjectUrl: '4/11/2018, 11:59:59 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523505599999,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Wed, 11 Apr 2018 04:00:00 GMT',
            thumbnailObjectUrl: '4/11/2018, 12:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523419200000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
      {
        type: 'thisWeek',
        mediaItems: [
          {
            objectURL: 'Wed, 11 Apr 2018 03:59:59 GMT',
            thumbnailObjectUrl: '4/10/2018, 11:59:59 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523419199999,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Tue, 10 Apr 2018 10:32:00 GMT',
            thumbnailObjectUrl: '4/10/2018, 6:32:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523356320000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Mon, 09 Apr 2018 04:00:00 GMT',
            thumbnailObjectUrl: '4/9/2018, 12:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523246400000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
      {
        type: 'thisMonth',
        mediaItems: [
          {
            objectURL: 'Mon, 09 Apr 2018 03:59:59 GMT',
            thumbnailObjectUrl: '4/8/2018, 11:59:59 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523246399999,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Sun, 08 Apr 2018 23:59:00 GMT',
            thumbnailObjectUrl: '4/8/2018, 7:59:00 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1523231940000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Sun, 01 Apr 2018 04:00:00 GMT',
            thumbnailObjectUrl: '4/1/2018, 12:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1522555200000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2018,
        month: 2,
        mediaItems: [
          {
            objectURL: 'Sun, 01 Apr 2018 03:59:59 GMT',
            thumbnailObjectUrl: '3/31/2018, 11:59:59 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1522555199999,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Sat, 31 Mar 2018 23:59:00 GMT',
            thumbnailObjectUrl: '3/31/2018, 7:59:00 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1522540740000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Thu, 01 Mar 2018 05:00:00 GMT',
            thumbnailObjectUrl: '3/1/2018, 12:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1519880400000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2017,
        month: 4,
        mediaItems: [
          {
            objectURL: 'Mon, 01 May 2017 04:00:00 GMT',
            thumbnailObjectUrl: '5/1/2017, 12:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1493611200000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2017,
        month: 3,
        mediaItems: [
          {
            objectURL: 'Mon, 01 May 2017 03:59:00 GMT',
            thumbnailObjectUrl: '4/30/2017, 11:59:00 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1493611140000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
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
            thumbnailObjectUrl: '2/28/2011, 6:59:00 PM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1298937540000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
          {
            objectURL: 'Tue, 01 Feb 2011 10:00:00 GMT',
            thumbnailObjectUrl: '2/1/2011, 5:00:00 AM',
            index: 0,
            message: {
              id: 'id',
              received_at: 1296554400000,
              attachments: [],
            },
            attachment: {
              fileName: 'fileName',
              contentType: IMAGE_JPEG,
              url: 'url',
            },
          },
        ],
      },
    ];

    const actual = groupMediaItemsByDate(referenceTime, input);
    assert.deepEqual(actual, expected);
  });
});
