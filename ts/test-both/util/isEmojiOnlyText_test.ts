// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isEmojiOnlyText } from '../../util/isEmojiOnlyText';

describe('isEmojiOnlyText', () => {
  it('returns false on empty string', () => {
    assert.isFalse(isEmojiOnlyText(''));
  });

  it('returns false on non-emoji string', () => {
    assert.isFalse(isEmojiOnlyText('123'));
  });

  it('returns false on mixed emoji/text string', () => {
    assert.isFalse(isEmojiOnlyText('12😎3'));
  });

  it('returns false on mixed emoji/text string starting with emoji', () => {
    assert.isFalse(isEmojiOnlyText('😎12😎3'));
  });

  it('returns true on all emoji string', () => {
    assert.isTrue(isEmojiOnlyText('😎👍😀😮‍💨'));
  });
});
