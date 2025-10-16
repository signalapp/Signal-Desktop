// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  ReadStatus,
  maxReadStatus,
} from '../../messages/MessageReadStatus.std.js';

describe('message read status utilities', () => {
  describe('maxReadStatus', () => {
    it('returns the status if passed the same status twice', () => {
      assert.strictEqual(
        maxReadStatus(ReadStatus.Unread, ReadStatus.Unread),
        ReadStatus.Unread
      );
    });

    it('sorts Unread < Read', () => {
      assert.strictEqual(
        maxReadStatus(ReadStatus.Unread, ReadStatus.Read),
        ReadStatus.Read
      );
      assert.strictEqual(
        maxReadStatus(ReadStatus.Read, ReadStatus.Unread),
        ReadStatus.Read
      );
    });

    it('sorts Read < Viewed', () => {
      assert.strictEqual(
        maxReadStatus(ReadStatus.Read, ReadStatus.Viewed),
        ReadStatus.Viewed
      );
      assert.strictEqual(
        maxReadStatus(ReadStatus.Viewed, ReadStatus.Read),
        ReadStatus.Viewed
      );
    });

    it('sorts Unread < Viewed', () => {
      assert.strictEqual(
        maxReadStatus(ReadStatus.Unread, ReadStatus.Viewed),
        ReadStatus.Viewed
      );
      assert.strictEqual(
        maxReadStatus(ReadStatus.Viewed, ReadStatus.Unread),
        ReadStatus.Viewed
      );
    });
  });
});
