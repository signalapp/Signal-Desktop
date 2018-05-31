import { assert } from 'chai';
import { shuffle } from 'lodash';

import {
  groupMessagesByDate,
  Section,
} from '../../../components/conversation/media-gallery/groupMessagesByDate';
import { Message } from '../../../components/conversation/media-gallery/types/Message';

const toMessage = (date: Date): Message => ({
  id: date.toUTCString(),
  received_at: date.getTime(),
  attachments: [],
});

describe('groupMessagesByDate', () => {
  it('should group messages', () => {
    const referenceTime = new Date('2018-04-12T18:00Z').getTime(); // Thu
    const input: Array<Message> = shuffle([
      // Today
      toMessage(new Date('2018-04-12T12:00Z')), // Thu
      toMessage(new Date('2018-04-12T00:01Z')), // Thu
      // This week
      toMessage(new Date('2018-04-11T23:59Z')), // Wed
      toMessage(new Date('2018-04-09T00:01Z')), // Mon
      // This month
      toMessage(new Date('2018-04-08T23:59Z')), // Sun
      toMessage(new Date('2018-04-01T00:01Z')),
      // March 2018
      toMessage(new Date('2018-03-31T23:59Z')),
      toMessage(new Date('2018-03-01T14:00Z')),
      // February 2011
      toMessage(new Date('2011-02-28T23:59Z')),
      toMessage(new Date('2011-02-01T10:00Z')),
    ]);

    const expected: Array<Section> = [
      {
        type: 'today',
        messages: [
          {
            id: 'Thu, 12 Apr 2018 12:00:00 GMT',
            received_at: 1523534400000,
            attachments: [],
          },
          {
            id: 'Thu, 12 Apr 2018 00:01:00 GMT',
            received_at: 1523491260000,
            attachments: [],
          },
        ],
      },
      {
        type: 'yesterday',
        messages: [
          {
            id: 'Wed, 11 Apr 2018 23:59:00 GMT',
            received_at: 1523491140000,
            attachments: [],
          },
        ],
      },
      {
        type: 'thisWeek',
        messages: [
          {
            id: 'Mon, 09 Apr 2018 00:01:00 GMT',
            received_at: 1523232060000,
            attachments: [],
          },
        ],
      },
      {
        type: 'thisMonth',
        messages: [
          {
            id: 'Sun, 08 Apr 2018 23:59:00 GMT',
            received_at: 1523231940000,
            attachments: [],
          },
          {
            id: 'Sun, 01 Apr 2018 00:01:00 GMT',
            received_at: 1522540860000,
            attachments: [],
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2018,
        month: 2,
        messages: [
          {
            id: 'Sat, 31 Mar 2018 23:59:00 GMT',
            received_at: 1522540740000,
            attachments: [],
          },
          {
            id: 'Thu, 01 Mar 2018 14:00:00 GMT',
            received_at: 1519912800000,
            attachments: [],
          },
        ],
      },
      {
        type: 'yearMonth',
        year: 2011,
        month: 1,
        messages: [
          {
            id: 'Mon, 28 Feb 2011 23:59:00 GMT',
            received_at: 1298937540000,
            attachments: [],
          },
          {
            id: 'Tue, 01 Feb 2011 10:00:00 GMT',
            received_at: 1296554400000,
            attachments: [],
          },
        ],
      },
    ];

    const actual = groupMessagesByDate(referenceTime, input);
    assert.deepEqual(actual, expected);
  });
});
