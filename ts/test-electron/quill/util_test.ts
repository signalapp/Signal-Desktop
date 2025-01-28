// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getDeltaToRemoveStaleMentions,
  getTextAndRangesFromOps,
  getDeltaToRestartMention,
} from '../../quill/util';
import { BodyRange } from '../../types/BodyRange';
import { generateAci } from '../../types/ServiceId';

const SERVICE_ID_1 = generateAci();
const SERVICE_ID_2 = generateAci();
const SERVICE_ID_3 = generateAci();
const SERVICE_ID_4 = generateAci();

describe('getDeltaToRemoveStaleMentions', () => {
  const memberUuids = [SERVICE_ID_1, SERVICE_ID_2];

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
            mention: { aci: SERVICE_ID_3, title: 'Klaus' },
          },
        },
        { insert: { mention: { aci: SERVICE_ID_1, title: 'Werner' } } },
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
            emoji: { value: '😂' },
          },
        },
        {
          insert: {
            emoji: { value: '🍋' },
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

  describe('given formatting', () => {
    it('handles trimming with simple ops', () => {
      const ops = [
        {
          insert: 'test test ',
          attributes: { bold: true },
        },
        // This is something Quill does for some reason
        {
          insert: '\n',
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'test test');
      assert.equal(bodyRanges.length, 1);
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 9,
          style: BodyRange.Style.BOLD,
        },
      ]);
    });

    it('handles trimming with no-formatting single- and multi-newline ops', () => {
      const ops = [
        {
          insert: 'line1',
          attributes: { bold: true },
        },
        // quill doesn't put formatting on all-newline ops
        {
          insert: '\n',
        },
        {
          insert: 'line2',
          attributes: { bold: true },
        },
        {
          insert: '\n\n',
        },
        {
          insert: 'line4',
          attributes: { bold: true },
        },
        {
          insert: '\n\n',
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'line1\nline2\n\nline4');
      assert.equal(bodyRanges.length, 1);
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 18,
          style: BodyRange.Style.BOLD,
        },
      ]);
    });

    it('handles trimming at the end of the message', () => {
      const ops = [
        {
          insert: 'Text with trailing ',
          attributes: { bold: true },
        },
        {
          insert: 'whitespace     ',
          attributes: { bold: true, italic: true },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'Text with trailing whitespace');
      assert.equal(bodyRanges.length, 2);
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 29,
          style: BodyRange.Style.BOLD,
        },
        {
          start: 19,
          length: 10,
          style: BodyRange.Style.ITALIC,
        },
      ]);
    });

    it('handles trimming at beginning of the message', () => {
      const ops = [
        {
          insert: '    Text with leading ',
          attributes: { bold: true },
        },
        {
          insert: 'whitespace!!',
          attributes: { bold: true, italic: true },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'Text with leading whitespace!!');
      assert.equal(bodyRanges.length, 2);
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 30,
          style: BodyRange.Style.BOLD,
        },
        {
          start: 18,
          length: 12,
          style: BodyRange.Style.ITALIC,
        },
      ]);
    });

    it('does not trim at beginning of the message if monospace', () => {
      const ops = [
        {
          insert: '  ',
        },
        {
          insert: '  Text with leading ',
          attributes: { monospace: true },
        },
        {
          insert: 'whitespace!!',
          attributes: { bold: true, italic: true },
        },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, '  Text with leading whitespace!!');
      assert.equal(bodyRanges.length, 3);
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 20,
          style: BodyRange.Style.MONOSPACE,
        },
        {
          start: 20,
          length: 12,
          style: BodyRange.Style.BOLD,
        },
        {
          start: 20,
          length: 12,
          style: BodyRange.Style.ITALIC,
        },
      ]);
    });

    it('handles formatting of whitespace at beginning/ending of message', () => {
      const ops = [
        {
          insert: '  ',
          attributes: { bold: true, italic: true, strike: true },
        },
        {
          insert: '  ',
          attributes: { italic: true, strike: true, spoiler: true },
        },
        {
          insert: 'so much whitespace',
          attributes: { strike: true, spoiler: true, monospace: true },
        },
        {
          insert: '  ',
          attributes: { spoiler: true, monospace: true, italic: true },
        },
        {
          insert: '  ',
          attributes: { monospace: true, italic: true, bold: true },
        },
        { insert: '\n' },
      ];
      const { text, bodyRanges } = getTextAndRangesFromOps(ops);
      assert.equal(text, 'so much whitespace');
      assert.equal(bodyRanges.length, 3);
      assert.deepEqual(bodyRanges, [
        {
          start: 0,
          length: 18,
          style: BodyRange.Style.STRIKETHROUGH,
        },
        {
          start: 0,
          length: 18,
          style: BodyRange.Style.SPOILER,
        },
        {
          start: 0,
          length: 18,
          style: BodyRange.Style.MONOSPACE,
        },
      ]);
    });
  });

  describe('given text, emoji, and mentions', () => {
    it('returns the trimmed text with placeholders and mentions', () => {
      const ops = [
        {
          insert: {
            emoji: { value: '😂' },
          },
        },
        {
          insert: ' wow, funny, ',
        },
        {
          insert: {
            mention: {
              aci: SERVICE_ID_1,
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
          mentionAci: SERVICE_ID_1,
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
              aci: SERVICE_ID_1,
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
          mentionAci: SERVICE_ID_1,
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
              aci: SERVICE_ID_1,
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
          mentionAci: SERVICE_ID_1,
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
              aci: SERVICE_ID_4,
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
          mentionAci: SERVICE_ID_4,
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
              aci: SERVICE_ID_4,
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
          mentionAci: SERVICE_ID_4,
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
            emoji: { value: '😂' },
          },
        },
        {
          insert: {
            mention: {
              aci: SERVICE_ID_2,
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
              aci: SERVICE_ID_1,
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
