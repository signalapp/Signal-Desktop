// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getDeltaToRemoveStaleMentions,
  getTextAndRangesFromOps,
  getDeltaToRestartMention,
} from '../../quill/util';
import { BodyRange } from '../../types/BodyRange';

describe('getDeltaToRemoveStaleMentions', () => {
  const memberUuids = ['abcdef', 'ghijkl'];

  describe('given text', () => {
    it('retains the text', () => {
      const originalOps = [
        {
          insert: 'whoa, nobody here',
        },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, [{ retain: 17 }]);
    });
  });

  describe('given stale and valid mentions', () => {
    it('retains the valid and replaces the stale', () => {
      const originalOps = [
        {
          insert: {
            mention: { uuid: '12345', title: 'Klaus' },
          },
        },
        { insert: { mention: { uuid: 'abcdef', title: 'Werner' } } },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, [
        { delete: 1 },
        { insert: '@Klaus' },
        { retain: 1 },
      ]);
    });
  });

  describe('given emoji embeds', () => {
    it('retains the embeds', () => {
      const originalOps = [
        {
          insert: {
            emoji: '😂',
          },
        },
        {
          insert: {
            emoji: '🍋',
          },
        },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, [{ retain: 1 }, { retain: 1 }]);
    });
  });

  describe('given other ops', () => {
    it('passes them through', () => {
      const originalOps = [
        {
          delete: 5,
        },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, originalOps);
    });
  });
});

describe('getTextAndRangesFromOps', () => {
  describe('given only text', () => {
    it('returns only text trimmed', () => {
      const ops = [{ insert: ' The ' }, { insert: ' text \n' }];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'The  text');
      assert.equal(bodyRanges.length, 0);
    });

    it('returns trimmed of trailing newlines', () => {
      const ops = [{ insert: ' The\ntext\n\n\n' }];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'The\ntext');
      assert.equal(bodyRanges.length, 0);
    });
  });

  describe('given text, emoji, and mentions', () => {
    it('returns the trimmed text with placeholders and mentions', () => {
      const ops = [
        {
          insert: {
            emoji: '😂',
          },
        },
        {
          insert: ' wow, funny, ',
        },
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, '😂 wow, funny, \uFFFC');
      assert.deepEqual(bodyRanges, [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: '@fred',
          start: 15,
        },
      ]);
    });
  });

  describe('given only mentions', () => {
    it('returns the trimmed text with placeholders and mentions', () => {
      const ops = [
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, '\uFFFC');
      assert.deepEqual(bodyRanges, [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: '@fred',
          start: 0,
        },
      ]);
    });

    it('does not trim newlines padding mentions', () => {
      const ops = [
        { insert: 'test \n' },
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
        { insert: '\n test' },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'test \n\uFFFC\n test');
      assert.deepEqual(bodyRanges, [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: '@fred',
          start: 6,
        },
      ]);
    });
  });

  describe('given formatting on text, with emoji and mentions', () => {
    it('handles overlapping and contiguous format sections properly', () => {
      const ops = [
        {
          insert: 'Hey, ',
          attributes: {
            spoiler: true,
          },
        },
        {
          insert: {
            mention: {
              uuid: 'a',
              title: '@alice',
            },
          },
          attributes: {
            spoiler: true,
          },
        },
        {
          insert: ': this is ',
          attributes: {
            spoiler: true,
          },
        },
        {
          insert: 'bold',
          attributes: {
            bold: true,
            spoiler: true,
          },
        },
        {
          insert: ' and',
          attributes: {
            bold: true,
            italic: true,
            spoiler: true,
          },
        },
        {
          insert: ' italic',
          attributes: {
            italic: true,
            spoiler: true,
          },
        },
        {
          insert: ' and strikethrough',
          attributes: {
            strike: true,
          },
        },
        { insert: ' ' },
        {
          insert: 'and monospace',
          attributes: {
            monospace: true,
          },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(
        text,
        'Hey, \uFFFC: this is bold and italic and strikethrough and monospace'
      );
      assert.deepEqual(bodyRanges, [
        {
          start: 5,
          length: 1,
          mentionUuid: 'a',
          replacementText: '@alice',
        },
        {
          start: 16,
          length: 8,
          style: BodyRange.Style.BOLD,
        },
        {
          start: 20,
          length: 11,
          style: BodyRange.Style.ITALIC,
        },
        {
          start: 0,
          length: 31,
          style: BodyRange.Style.SPOILER,
        },
        {
          start: 31,
          length: 18,
          style: BodyRange.Style.STRIKETHROUGH,
        },
        {
          start: 50,
          length: 13,
          style: BodyRange.Style.MONOSPACE,
        },
      ]);
    });

    it('handles lots of the same format', () => {
      const ops = [
        {
          insert: 'Every',
          attributes: {
            bold: true,
          },
        },
        {
          insert: ' other ',
        },
        {
          insert: 'word',
          attributes: {
            bold: true,
          },
        },
        {
          insert: ' is ',
        },
        {
          insert: 'bold!',
          attributes: {
            bold: true,
          },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'Every other word is bold!');
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 5,
          style: BodyRange.Style.BOLD,
        },
        {
          start: 12,
          length: 4,
          style: BodyRange.Style.BOLD,
        },
        {
          start: 20,
          length: 5,
          style: BodyRange.Style.BOLD,
        },
      ]);
    });

    it('handles formatting on mentions', () => {
      const ops = [
        {
          insert: {
            mention: {
              uuid: 'a',
              title: '@alice',
            },
          },
          attributes: {
            bold: true,
          },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, '\uFFFC');
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 1,
          mentionUuid: 'a',
          replacementText: '@alice',
        },
        {
          start: 0,
          length: 1,
          style: BodyRange.Style.BOLD,
        },
      ]);
    });
  });
});

describe('getDeltaToRestartMention', () => {
  describe('given text and emoji', () => {
    it('returns the correct retains, a delete, and an @', () => {
      const originalOps = [
        {
          insert: {
            emoji: '😂',
          },
        },
        {
          insert: {
            mention: {
              uuid: 'ghijkl',
              title: '@sam',
            },
          },
        },
        {
          insert: ' wow, funny, ',
        },
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
      ];

      const { ops } = getDeltaToRestartMention(originalOps);

      assert.deepEqual(ops, [
        {
          retain: 1,
        },
        {
          retain: 1,
        },
        {
          retain: 13,
        },
        {
          retain: 1,
        },
        {
          delete: 1,
        },
        {
          insert: '@',
        },
      ]);
    });
  });
});
