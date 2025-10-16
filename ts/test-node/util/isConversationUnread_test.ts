// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isConversationUnread } from '../../util/isConversationUnread.std.js';

describe('isConversationUnread', () => {
  it('returns false if both markedUnread and unreadCount are undefined', () => {
    assert.isFalse(isConversationUnread({}));
    assert.isFalse(
      isConversationUnread({
        markedUnread: undefined,
        unreadCount: undefined,
      })
    );
  });

  it('returns false if markedUnread is false', () => {
    assert.isFalse(isConversationUnread({ markedUnread: false }));
  });

  it('returns false if unreadCount is 0', () => {
    assert.isFalse(isConversationUnread({ unreadCount: 0 }));
  });

  it('returns true if markedUnread is true, regardless of unreadCount', () => {
    assert.isTrue(isConversationUnread({ markedUnread: true }));
    assert.isTrue(isConversationUnread({ markedUnread: true, unreadCount: 0 }));
    assert.isTrue(
      isConversationUnread({ markedUnread: true, unreadCount: 100 })
    );
  });

  it('returns true if unreadCount is positive, regardless of markedUnread', () => {
    assert.isTrue(isConversationUnread({ unreadCount: 1 }));
    assert.isTrue(isConversationUnread({ unreadCount: 99 }));
    assert.isTrue(
      isConversationUnread({ markedUnread: false, unreadCount: 2 })
    );
  });

  it('returns true if both markedUnread is true and unreadCount is positive', () => {
    assert.isTrue(isConversationUnread({ markedUnread: true, unreadCount: 1 }));
  });
});
