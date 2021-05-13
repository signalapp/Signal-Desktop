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
        avatarPath: '/path/to/avatar.jpg',
        sharedGroupNames: [],
        unblurredAvatarPath: undefined,
      })
    );
  });

  it('returns false if the message request has been accepted', () => {
    assert.isFalse(
      shouldBlurAvatar({
        acceptedMessageRequest: true,
        avatarPath: '/path/to/avatar.jpg',
        isMe: false,
        sharedGroupNames: [],
        unblurredAvatarPath: undefined,
      })
    );
  });

  it('returns false if there are any shared groups', () => {
    assert.isFalse(
      shouldBlurAvatar({
        sharedGroupNames: ['Tahoe Trip'],
        acceptedMessageRequest: false,
        avatarPath: '/path/to/avatar.jpg',
        isMe: false,
        unblurredAvatarPath: undefined,
      })
    );
  });

  it('returns false if there is no avatar', () => {
    assert.isFalse(
      shouldBlurAvatar({
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
        unblurredAvatarPath: undefined,
      })
    );
    assert.isFalse(
      shouldBlurAvatar({
        avatarPath: undefined,
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
        unblurredAvatarPath: undefined,
      })
    );
    assert.isFalse(
      shouldBlurAvatar({
        avatarPath: undefined,
        unblurredAvatarPath: '/some/other/path',
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
      })
    );
  });

  it('returns false if the avatar was unblurred', () => {
    assert.isFalse(
      shouldBlurAvatar({
        avatarPath: '/path/to/avatar.jpg',
        unblurredAvatarPath: '/path/to/avatar.jpg',
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
      })
    );
  });

  it('returns true if the stars align (i.e., not everything above)', () => {
    assert.isTrue(
      shouldBlurAvatar({
        avatarPath: '/path/to/avatar.jpg',
        unblurredAvatarPath: '/different/path.jpg',
        acceptedMessageRequest: false,
        isMe: false,
        sharedGroupNames: [],
      })
    );
  });
});
