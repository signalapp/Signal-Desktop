// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getTextWithMentions } from '../../util/getTextWithMentions';

describe('getTextWithMentions', () => {
  describe('given mention replacements', () => {
    it('replaces them', () => {
      const bodyRanges = [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: 'fred',
          start: 4,
        },
      ];
      const text = "Hey \uFFFC, I'm here";
      assert.strictEqual(
        getTextWithMentions(bodyRanges, text),
        "Hey @fred, I'm here"
      );
    });

    it('sorts them to go from back to front', () => {
      const bodyRanges = [
        {
          length: 1,
          mentionUuid: 'blarg',
          replacementText: 'jerry',
          start: 0,
        },
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: 'fred',
          start: 7,
        },
      ];
      const text = "\uFFFC says \uFFFC, I'm here";
      assert.strictEqual(
        getTextWithMentions(bodyRanges, text),
        "@jerry says @fred, I'm here"
      );
    });
  });
});
