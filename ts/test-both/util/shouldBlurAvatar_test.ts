// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { shouldBlurAvatar } from '../../util/shouldBlurAvatar';

describe('shouldBlurAvatar', () => {
  it('returns false for me', () => {
    assert.isFalse(
      shouldBlurAvatar({
        isMe: true,
        acceptedMessageRequest: false,
        avatarUrl: '/path/to/avatar.jpg',
        sharedGroupNames: [],
        unblurredAvatarUrl: undefined,
      })
    );
  });

  it('returns false if the message request has been accepted', () => {
    assert.isFalse(
      shouldBlurAvatar({
        acceptedMessageRequest: true,
        avatarUrl: '/path/to/avatar.jpg',
        isMe: false,
        sharedGroupNames: [],
        unblurredAvatarUrl: undefined,
      })
    );
  });

  it('returns false if there are any shared groups', () => {
    assert.isFalse(
      shouldBlurAvatar({
        sharedGroupNames: ['Tahoe Trip'],
        acceptedMessageRequest: false,
        avatarUrl: '/path/to/avatar.jpg',
        isMe: false,
        unblurredAvatarUrl: undefined,
      })
    );
  });

  it('returns false if there is no avatar', () => {
    assert.isFalse(
      shouldBlurAvatar({
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
        unblurredAvatarUrl: undefined,
      })
    );
    assert.isFalse(
      shouldBlurAvatar({
        avatarUrl: undefined,
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
        unblurredAvatarUrl: undefined,
      })
    );
    assert.isFalse(
      shouldBlurAvatar({
        avatarUrl: undefined,
        unblurredAvatarUrl: '/some/other/path',
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
      })
    );
  });

  it('returns false if the avatar was unblurred', () => {
    assert.isFalse(
      shouldBlurAvatar({
        avatarUrl: '/path/to/avatar.jpg',
        unblurredAvatarUrl: '/path/to/avatar.jpg',
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
      })
    );
  });

  it('returns true if the stars align (i.e., not everything above)', () => {
    assert.isTrue(
      shouldBlurAvatar({
        avatarUrl: '/path/to/avatar.jpg',
        unblurredAvatarUrl: '/different/path.jpg',
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
      })
    );
  });
});
