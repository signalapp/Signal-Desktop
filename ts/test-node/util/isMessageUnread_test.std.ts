// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';

import { isMessageUnread } from '../../util/isMessageUnread.std.js';

describe('isMessageUnread', () => {
  it("returns false if the message's `readStatus` field is undefined", () => {
    assert.isFalse(isMessageUnread({}));
    assert.isFalse(isMessageUnread({ readStatus: undefined }));
  });

  it('returns false if the message is read or viewed', () => {
    assert.isFalse(isMessageUnread({ readStatus: ReadStatus.Read }));
    assert.isFalse(isMessageUnread({ readStatus: ReadStatus.Viewed }));
  });

  it('returns true if the message is unread', () => {
    assert.isTrue(isMessageUnread({ readStatus: ReadStatus.Unread }));
  });
});
