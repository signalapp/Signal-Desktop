// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isMessageUnread } from '../../util/isMessageUnread';

describe('isMessageUnread', () => {
  it("returns false if the message's `unread` field is undefined", () => {
    assert.isFalse(isMessageUnread({}));
    assert.isFalse(isMessageUnread({ unread: undefined }));
  });

  it('returns false if the message is read', () => {
    assert.isFalse(isMessageUnread({ unread: false }));
  });

  it('returns true if the message is unread', () => {
    assert.isTrue(isMessageUnread({ unread: true }));
  });
});
