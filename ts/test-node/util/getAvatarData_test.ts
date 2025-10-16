// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { getRandomColor } from '../../test-helpers/getRandomColor.std.js';

import { getAvatarData } from '../../util/getAvatarData.dom.js';

describe('getAvatarData', () => {
  it('returns existing avatars if present', () => {
    const avatars = [
      {
        id: uuid(),
        color: getRandomColor(),
        text: 'Avatar A',
      },
      {
        id: uuid(),
        color: getRandomColor(),
        text: 'Avatar B',
      },
    ];

    assert.strictEqual(getAvatarData({ avatars, type: 'private' }), avatars);
    assert.strictEqual(getAvatarData({ avatars, type: 'group' }), avatars);
  });

  it('returns a non-empty array if no avatars are provided', () => {
    assert.isNotEmpty(getAvatarData({ type: 'private' }));
    assert.isNotEmpty(getAvatarData({ type: 'group' }));
    assert.isNotEmpty(getAvatarData({ avatars: [], type: 'private' }));
    assert.isNotEmpty(getAvatarData({ avatars: [], type: 'group' }));
  });
});
