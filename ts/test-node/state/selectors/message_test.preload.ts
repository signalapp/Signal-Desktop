// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { canTranslate } from '../../../state/selectors/message.preload.ts';
import { BodyRange } from '../../../types/BodyRange.std.ts';
import type { HydratedBodyRangesType } from '../../../types/BodyRange.std.ts';

describe('both/state/selectors/message canTranslate', () => {
  const message = { body: 'hello world', deletedForEveryone: false };

  it('is true for a plain text message with no bodyRanges', () => {
    assert.isTrue(canTranslate(message, undefined));
  });

  it('is false for a deleted-for-everyone message', () => {
    assert.isFalse(
      canTranslate({ body: 'hello', deletedForEveryone: true }, undefined)
    );
  });

  it('is false for a message with no body text', () => {
    assert.isFalse(canTranslate({ body: '', deletedForEveryone: false }, undefined));
    assert.isFalse(
      canTranslate({ body: '   ', deletedForEveryone: false }, undefined)
    );
  });

  it('is false when the message has a spoiler range, so translated text can never expose it', () => {
    const bodyRanges: HydratedBodyRangesType = [
      {
        start: 0,
        length: 5,
        style: BodyRange.Style.SPOILER,
      },
    ];
    assert.isFalse(canTranslate(message, bodyRanges));
  });

  it('is true when bodyRanges exist but none of them are a spoiler', () => {
    const bodyRanges: HydratedBodyRangesType = [
      {
        start: 0,
        length: 5,
        style: BodyRange.Style.BOLD,
      },
    ];
    assert.isTrue(canTranslate(message, bodyRanges));
  });
});
