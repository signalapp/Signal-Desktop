// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { parseRawSyncDataArray } from '../../../jobs/helpers/syncHelpers';

describe('read and view sync helpers', () => {
  describe('parseRawSyncDataArray', () => {
    it('errors if not passed an array', () => {
      [undefined, { timestamp: 123 }].forEach(input => {
        assert.throws(() => parseRawSyncDataArray(input));
      });
    });

    it('errors if passed an array with any invalid elements', () => {
      const valid = {
        messageId: '4a3ad1e1-61a7-464d-9982-f3e8eea81818',
        senderUuid: '253ce806-7375-4227-82ed-eb8321630133',
        timestamp: 1234,
      };

      [undefined, {}, { messageId: -1, timestamp: 4567 }].forEach(invalid => {
        assert.throws(() => parseRawSyncDataArray([valid, invalid]));
      });
    });

    it('does nothing to an empty array', () => {
      assert.deepEqual(parseRawSyncDataArray([]), []);
    });

    it('handles a valid array', () => {
      assert.deepEqual(
        parseRawSyncDataArray([
          {
            senderUuid: 'd9e1e89b-f4a6-4c30-b3ec-8e7a964f94bd',
            timestamp: 1234,
          },
          {
            messageId: '4a3ad1e1-61a7-464d-9982-f3e8eea81818',
            senderE164: undefined,
            senderUuid: '253ce806-7375-4227-82ed-eb8321630133',
            timestamp: 4567,
          },
        ]),
        [
          {
            messageId: undefined,
            senderE164: undefined,
            senderUuid: 'd9e1e89b-f4a6-4c30-b3ec-8e7a964f94bd',
            timestamp: 1234,
          },
          {
            messageId: '4a3ad1e1-61a7-464d-9982-f3e8eea81818',
            senderE164: undefined,
            senderUuid: '253ce806-7375-4227-82ed-eb8321630133',
            timestamp: 4567,
          },
        ]
      );
    });

    it('turns `null` into `undefined`', () => {
      assert.deepEqual(
        parseRawSyncDataArray([
          {
            messageId: null,
            senderUuid: 'd9e1e89b-f4a6-4c30-b3ec-8e7a964f94bd',
            timestamp: 1234,
          },
        ]),
        [
          {
            messageId: undefined,
            senderE164: undefined,
            senderUuid: 'd9e1e89b-f4a6-4c30-b3ec-8e7a964f94bd',
            timestamp: 1234,
          },
        ]
      );
    });

    it('removes extra properties', () => {
      assert.deepEqual(
        parseRawSyncDataArray([
          {
            timestamp: 1234,
            extra: true,
          },
        ]),
        [
          {
            messageId: undefined,
            senderE164: undefined,
            senderUuid: undefined,
            timestamp: 1234,
          },
        ]
      );
    });
  });
});
