// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getDefaultAvatars } from '../../types/Avatar.std.js';

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
});
