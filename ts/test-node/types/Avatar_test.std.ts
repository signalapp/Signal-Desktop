// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { AvatarUpdateType } from '../../types/Avatar.std.ts';
import {
  getDefaultAvatars,
  ProfileAvatarChange,
} from '../../types/Avatar.std.ts';

describe('Avatar', () => {
  describe('getDefaultAvatars', () => {
    it('returns an array of valid avatars for direct conversations', () => {
      assert.isNotEmpty(getDefaultAvatars(false));
    });

    it('returns an array of valid avatars for group conversations', () => {
      assert.isNotEmpty(getDefaultAvatars(true));
    });

    it('defaults to returning avatars for direct conversations', () => {
      const defaultResult = getDefaultAvatars();
      const directResult = getDefaultAvatars(false);
      const groupResult = getDefaultAvatars(true);

      assert.deepEqual(defaultResult, directResult);
      assert.notDeepEqual(defaultResult, groupResult);
    });
  });

  describe('ProfileAvatarChange.fromAvatarUpdate', () => {
    const avatarA = new Uint8Array([1, 2, 3]);
    const avatarB = new Uint8Array([4, 5, 6, 7]);

    function check(
      avatarUpdate: AvatarUpdateType,
      expected: ProfileAvatarChange
    ) {
      assert.deepEqual(
        ProfileAvatarChange.fromAvatarUpdate(avatarUpdate),
        expected
      );
    }

    it('clears when there is no new avatar', () => {
      check(
        { oldAvatar: avatarA, newAvatar: undefined, reupload: false },
        { type: 'clear' }
      );
    });

    it('clears when there was never an avatar', () => {
      check(
        { oldAvatar: undefined, newAvatar: undefined, reupload: false },
        { type: 'clear' }
      );
    });

    it('is unchanged when the avatar is the same', () => {
      check(
        { oldAvatar: avatarA, newAvatar: avatarA, reupload: false },
        { type: 'unchanged' }
      );
    });

    it('updates when the avatar is different', () => {
      check(
        { oldAvatar: avatarA, newAvatar: avatarB, reupload: false },
        { type: 'update', avatar: avatarB }
      );
    });

    it('updates when there was no old avatar', () => {
      check(
        { oldAvatar: undefined, newAvatar: avatarA, reupload: false },
        { type: 'update', avatar: avatarA }
      );
    });

    it('updates the same avatar when re-uploading', () => {
      check(
        { oldAvatar: avatarA, newAvatar: avatarA, reupload: true },
        { type: 'update', avatar: avatarA }
      );
    });
  });
});
