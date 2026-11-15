// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type {
  DisplayNode,
  HydratedBodyRangeMention,
} from '../../types/BodyRange.std.ts';
import {
  BodyRange,
  DisplayStyle,
  applyRangeToText,
  applyRangesToText,
  collapseRangesToDisplayNodes,
  getInvisibleInkBodyRanges,
  processBodyRangesForSearchResult,
  trimMessageWhitespace,
} from '../../types/BodyRange.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';

const SERVICE_ID_1 = generateAci();
const SERVICE_ID_2 = generateAci();

const mentionInfo = {
  mentionAci: SERVICE_ID_1,
  conversationID: 'convoid',
  replacementText: 'dude',
};

describe('BodyRanges', () => {
  function style(
    start: number,
    length: number,
    styleValue: BodyRange.Style
  ): BodyRange<BodyRange.Formatting> {
    return {
      start,
      length,
      style: styleValue,
    };
  }

  function composeNode(
    fields: Pick<DisplayNode, 'text' | 'start' | 'length'> &
      Partial<DisplayNode>
  ): DisplayNode {
    return {
      isBold: false,
      isItalic: false,
      isMonospace: false,
      isStrikethrough: false,
      isKeywordHighlight: false,
      url: undefined,
      mentions: [],
      ...fields,
    };
  }

  describe('getInvisibleInkBodyRanges', () => {
    it('covers UTF-16 text with one spoiler and preserves other ranges', () => {
      const bold = style(0, 2, BodyRange.Style.BOLD);
      const mention = { start: 3, length: 1, ...mentionInfo };
      assert.deepEqual(
        getInvisibleInkBodyRanges('🎉 \uFFFC', [
          bold,
          style(0, 2, BodyRange.Style.SPOILER),
          mention,
        ]),
        [{ start: 0, length: 4, style: BodyRange.Style.SPOILER }, bold, mention]
      );
    });

    it('requires a non-empty message that fits in the inline body', () => {
      assert.isNull(getInvisibleInkBodyRanges('', []));
      assert.isNotNull(getInvisibleInkBodyRanges('🎉'.repeat(512), []));
      assert.isNull(getInvisibleInkBodyRanges('🎉'.repeat(513), []));
    });

    it('requires directional formatting that iOS can display without adding controls', () => {
      assert.isNull(getInvisibleInkBodyRanges('A \u202E surprise', []));
      assert.isNull(getInvisibleInkBodyRanges('A surprise\u2069', []));
      assert.isNotNull(
        getInvisibleInkBodyRanges('A \u202E surprise\u202C', [])
      );
    });

    it('requires grapheme clusters that iOS can display without replacement', () => {
      assert.isNotNull(
        getInvisibleInkBodyRanges(`A${'\u0301'.repeat(15)}`, [])
      );
      assert.isNull(getInvisibleInkBodyRanges(`A${'\u0301'.repeat(16)}`, []));
    });

    it('does not displace existing ranges at the recipient range limit', () => {
      const ranges = Array.from({ length: 250 }, (_, index) =>
        style(index * 2, 1, BodyRange.Style.BOLD)
      );
      assert.isNull(getInvisibleInkBodyRanges('X '.repeat(250), ranges));
      assert.lengthOf(
        getInvisibleInkBodyRanges('X '.repeat(250), ranges.slice(0, -1)) ?? [],
        250
      );
    });
  });

  describe('collapseRangesToDisplayNodes', () => {
    it('inserts a single mention', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes('\uFFFC', [
          { start: 0, length: 1, ...mentionInfo },
        ]),

        [
          composeNode({
            text: '\uFFFC',
            start: 0,
            length: 1,
            mentions: [{ start: 0, length: 1, ...mentionInfo }],
          }),
        ]
      );
    });

    it('intersects ranges by splitting up and nesting', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes('abcdefghijklmnopqrst', [
          {
            start: 5,
            length: 10,
            style: BodyRange.Style.BOLD,
          },
          {
            start: 10,
            length: 10,
            style: BodyRange.Style.ITALIC,
          },
        ]),

        [
          composeNode({
            text: 'abcde',
            start: 0,
            length: 5,
          }),
          composeNode({
            text: 'fghij',
            start: 5,
            length: 5,
            isBold: true,
          }),
          composeNode({
            text: 'klmno',
            start: 10,
            length: 5,
            isBold: true,
            isItalic: true,
          }),
          composeNode({
            text: 'pqrst',
            start: 15,
            length: 5,
            isItalic: true,
          }),
        ]
      );
    });

    it('handles triple-nesting', () => {
      //                                                                 m            m
      // b                                      bs                                                          s
      // i                                                                                                             i
      // Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End,

      assert.deepEqual(
        collapseRangesToDisplayNodes(
          'Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End',
          [
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.BOLD,
            },
            {
              start: 0,
              length: 111,
              style: BodyRange.Style.ITALIC,
            },
            {
              start: 40,
              length: 60,
              style: BodyRange.Style.STRIKETHROUGH,
            },
            {
              start: 64,
              length: 14,
              style: BodyRange.Style.MONOSPACE,
            },
          ]
        ),
        [
          composeNode({
            text: 'Italic Start and Bold Start ... Bold End',
            start: 0,
            length: 40,
            isBold: true,
            isItalic: true,
          }),
          composeNode({
            text: 'Strikethrough Start ... ',
            start: 40,
            length: 24,
            isItalic: true,
            isStrikethrough: true,
          }),
          composeNode({
            text: 'Monospace Pop!',
            start: 64,
            length: 14,
            isStrikethrough: true,
            isItalic: true,
            isMonospace: true,
          }),
          composeNode({
            text: ' ... Strikethrough End',
            start: 78,
            length: 22,
            isStrikethrough: true,
            isItalic: true,
          }),
          composeNode({
            text: ' Italic End',
            start: 100,
            length: 11,
            isItalic: true,
          }),
        ]
      );
    });

    it('handles triple-nesting, with out-of-order inputs', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes(
          'Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End',
          [
            {
              start: 64,
              length: 14,
              style: BodyRange.Style.MONOSPACE,
            },
            {
              start: 40,
              length: 60,
              style: BodyRange.Style.STRIKETHROUGH,
            },
            {
              start: 0,
              length: 111,
              style: BodyRange.Style.ITALIC,
            },
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.BOLD,
            },
          ]
        ),
        [
          composeNode({
            text: 'Italic Start and Bold Start ... Bold End',
            start: 0,
            length: 40,
            isBold: true,
            isItalic: true,
          }),
          composeNode({
            text: 'Strikethrough Start ... ',
            start: 40,
            length: 24,
            isItalic: true,
            isStrikethrough: true,
          }),
          composeNode({
            text: 'Monospace Pop!',
            start: 64,
            length: 14,
            isStrikethrough: true,
            isItalic: true,
            isMonospace: true,
          }),
          composeNode({
            text: ' ... Strikethrough End',
            start: 78,
            length: 22,
            isStrikethrough: true,
            isItalic: true,
          }),
          composeNode({
            text: ' Italic End',
            start: 100,
            length: 11,
            isItalic: true,
          }),
        ]
      );
    });

    it('handles basic nested styles', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes('.... Bold I**** .... Basic Text', [
          { start: 5, length: 10, style: BodyRange.Style.BOLD },
          { start: 10, length: 5, style: BodyRange.Style.ITALIC },
          { start: 15, length: 5, style: BodyRange.Style.ITALIC },
        ]),
        [
          composeNode({ text: '.... ', start: 0, length: 5 }),
          composeNode({ text: 'Bold ', start: 5, length: 5, isBold: true }),
          composeNode({
            text: 'I****',
            start: 10,
            length: 5,
            isBold: true,
            isItalic: true,
          }),
          composeNode({ text: ' ....', start: 15, length: 5, isItalic: true }),
          composeNode({ text: ' Basic Text', start: 20, length: 11 }),
        ]
      );
    });

    it('handles complex nested styles', () => {
      const text =
        'Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End';
      assert.deepEqual(
        collapseRangesToDisplayNodes(text, [
          { start: 0, length: 40, style: BodyRange.Style.BOLD },
          { start: 0, length: 40, style: BodyRange.Style.ITALIC },
          { start: 40, length: 71, style: BodyRange.Style.ITALIC },
          { start: 40, length: 60, style: BodyRange.Style.STRIKETHROUGH },
          { start: 64, length: 14, style: BodyRange.Style.MONOSPACE },
        ]),
        [
          composeNode({
            text: 'Italic Start and Bold Start ... Bold End',
            start: 0,
            length: 40,
            isBold: true,
            isItalic: true,
          }),
          composeNode({
            text: 'Strikethrough Start ... ',
            start: 40,
            length: 24,
            isItalic: true,
            isStrikethrough: true,
          }),
          composeNode({
            text: 'Monospace Pop!',
            start: 64,
            length: 14,
            isItalic: true,
            isStrikethrough: true,
            isMonospace: true,
          }),
          composeNode({
            text: ' ... Strikethrough End',
            start: 78,
            length: 22,
            isItalic: true,
            isStrikethrough: true,
          }),
          composeNode({
            text: ' Italic End',
            start: 100,
            length: 11,
            isItalic: true,
          }),
        ]
      );
    });

    it('handles complex nested styles with embedded mentions', () => {
      const text =
        'Italic Start and Bold Start .\uFFFC. Bold EndStrikethrough Start .\uFFFC. Mono\uFFFCpace Pop! .\uFFFC. Strikethrough End Ital\uFFFCc End';
      assert.deepEqual(
        collapseRangesToDisplayNodes(text, [
          { start: 0, length: 40, style: BodyRange.Style.BOLD },
          { start: 0, length: 40, style: BodyRange.Style.ITALIC },
          { start: 40, length: 71, style: BodyRange.Style.ITALIC },
          { start: 40, length: 60, style: BodyRange.Style.STRIKETHROUGH },
          { start: 64, length: 14, style: BodyRange.Style.MONOSPACE },
          { start: 29, length: 1, ...mentionInfo, replacementText: 'A' },
          { start: 61, length: 1, ...mentionInfo, replacementText: 'B' },
          { start: 68, length: 1, ...mentionInfo, replacementText: 'C' },
          { start: 80, length: 1, ...mentionInfo, replacementText: 'D' },
          { start: 105, length: 1, ...mentionInfo, replacementText: 'E' },
        ]),
        [
          composeNode({
            text: 'Italic Start and Bold Start .\uFFFC. Bold End',
            start: 0,
            length: 40,
            isBold: true,
            isItalic: true,
            mentions: [
              { start: 29, length: 1, ...mentionInfo, replacementText: 'A' },
            ],
          }),
          composeNode({
            text: 'Strikethrough Start .\uFFFC. ',
            start: 40,
            length: 24,
            isItalic: true,
            isStrikethrough: true,
            mentions: [
              { start: 21, length: 1, ...mentionInfo, replacementText: 'B' },
            ],
          }),
          composeNode({
            text: 'Mono\uFFFCpace Pop!',
            start: 64,
            length: 14,
            isItalic: true,
            isStrikethrough: true,
            isMonospace: true,
            mentions: [
              { start: 4, length: 1, ...mentionInfo, replacementText: 'C' },
            ],
          }),
          composeNode({
            text: ' .\uFFFC. Strikethrough End',
            start: 78,
            length: 22,
            isItalic: true,
            isStrikethrough: true,
            mentions: [
              { start: 2, length: 1, ...mentionInfo, replacementText: 'D' },
            ],
          }),
          composeNode({
            text: ' Ital\uFFFCc End',
            start: 100,
            length: 11,
            isItalic: true,
            mentions: [
              { start: 5, length: 1, ...mentionInfo, replacementText: 'E' },
            ],
          }),
        ]
      );
    });

    it('keeps a style active while any overlapping range of it still covers the text', () => {
      // Refcount: the tail (ghij) stays bold after the first bold range ends at
      // 6, because the second still covers it.
      assert.deepEqual(
        collapseRangesToDisplayNodes('abcdefghij', [
          { start: 0, length: 6, style: BodyRange.Style.BOLD },
          { start: 4, length: 6, style: BodyRange.Style.BOLD },
        ]),
        [
          composeNode({ text: 'abcd', start: 0, length: 4, isBold: true }),
          composeNode({ text: 'ef', start: 4, length: 2, isBold: true }),
          composeNode({ text: 'ghij', start: 6, length: 4, isBold: true }),
        ]
      );
    });

    it('ends one spoiler and starts another at a shared boundary', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes('abcdef', [
          { start: 0, length: 3, style: BodyRange.Style.SPOILER, spoilerId: 1 },
          { start: 3, length: 3, style: BodyRange.Style.SPOILER, spoilerId: 2 },
        ]),
        [
          composeNode({
            text: 'abc',
            start: 0,
            length: 3,
            isSpoiler: true,
            spoilerId: 1,
          }),
          composeNode({
            text: 'def',
            start: 3,
            length: 3,
            isSpoiler: true,
            spoilerId: 2,
          }),
        ]
      );
    });

    it('keeps the spoiler active across an inner formatting boundary', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes('abcdefghij', [
          {
            start: 0,
            length: 10,
            style: BodyRange.Style.SPOILER,
            spoilerId: 1,
          },
          { start: 3, length: 4, style: BodyRange.Style.BOLD },
        ]),
        [
          composeNode({
            text: 'abc',
            start: 0,
            length: 3,
            isSpoiler: true,
            spoilerId: 1,
          }),
          composeNode({
            text: 'defg',
            start: 3,
            length: 4,
            isBold: true,
            isSpoiler: true,
            spoilerId: 1,
          }),
          composeNode({
            text: 'hij',
            start: 7,
            length: 3,
            isSpoiler: true,
            spoilerId: 1,
          }),
        ]
      );
    });

    it('carries a link url', () => {
      assert.deepEqual(
        collapseRangesToDisplayNodes('abcde', [
          { start: 1, length: 3, url: 'https://example' },
        ]),
        [
          composeNode({ text: 'a', start: 0, length: 1 }),
          composeNode({
            text: 'bcd',
            start: 1,
            length: 3,
            url: 'https://example',
          }),
          composeNode({ text: 'e', start: 4, length: 1 }),
        ]
      );
    });
  });

  describe('processBodyRangesForSearchResult', () => {
    it('returns proper bodyRange surrounding keyword', () => {
      const { cleanedSnippet, bodyRanges } = processBodyRangesForSearchResult({
        snippet: "What's <<left>>going<<right>> on?",
        body: "What's going on?",
        bodyRanges: [],
      });

      assert.strictEqual(cleanedSnippet, "What's going on?");
      assert.lengthOf(bodyRanges, 1);
      assert.deepEqual(bodyRanges[0], {
        start: 7,
        length: 5,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });

    it('returns proper bodyRange surrounding multiple keywords', () => {
      const { cleanedSnippet, bodyRanges } = processBodyRangesForSearchResult({
        snippet: "What's <<left>>going<<right>> <<left>>on<<right>>?",
        body: "What's going on?",
        bodyRanges: [],
      });

      assert.strictEqual(cleanedSnippet, "What's going on?");
      assert.lengthOf(bodyRanges, 2);
      assert.deepEqual(bodyRanges[0], {
        start: 7,
        length: 5,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
      assert.deepEqual(bodyRanges[1], {
        start: 13,
        length: 2,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });

    it('returns proper bodyRange surrounding keyword, with trailing ...', () => {
      const { cleanedSnippet, bodyRanges } = processBodyRangesForSearchResult({
        snippet: "What's <<left>>going<<right>> on<<truncation>>",
        body: "What's going on, man? Good to see you!",
        bodyRanges: [],
      });

      assert.strictEqual(cleanedSnippet, "What's going on...");
      assert.lengthOf(bodyRanges, 1);
      assert.deepEqual(bodyRanges[0], {
        start: 7,
        length: 5,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });

    it('returns proper bodyRange surrounding keyword, with leading ...', () => {
      const { cleanedSnippet, bodyRanges } = processBodyRangesForSearchResult({
        snippet: "<<truncation>>what's <<left>>going<<right>> on<<truncation>>",
        body: "And what's going on with you?",
        bodyRanges: [],
      });

      assert.strictEqual(cleanedSnippet, "...what's going on...");
      assert.lengthOf(bodyRanges, 1);
      assert.deepEqual(bodyRanges[0], {
        start: 10,
        length: 5,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });

    it('handles multiple mentions without leading/trailing ...', () => {
      const bodyRanges = [
        {
          start: 0,
          length: 1,
          mentionAci: SERVICE_ID_2,
          replacementText: 'Alice',
          conversationID: 'x',
        },
        {
          start: 21,
          length: 1,
          mentionAci: SERVICE_ID_2,
          replacementText: 'Eve',
          conversationID: 'x',
        },
      ];
      const { cleanedSnippet, bodyRanges: processedBodyRanges } =
        processBodyRangesForSearchResult({
          snippet: "\uFFFC, what's <<left>>going<<right>> with \uFFFC?",
          body: "\uFFFC, what's going with \uFFFC?",
          bodyRanges,
        });

      assert.strictEqual(cleanedSnippet, "\uFFFC, what's going with \uFFFC?");
      assert.lengthOf(processedBodyRanges, 3);

      assert.deepEqual(processedBodyRanges[0], bodyRanges[0]);
      assert.deepEqual(processedBodyRanges[1], bodyRanges[1]);
      assert.deepEqual(processedBodyRanges[2], {
        start: 10,
        length: 5,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });

    it('handles multiple mentions with leading/trailing ...', () => {
      const bodyRanges = [
        {
          start: 18,
          length: 1,
          mentionAci: SERVICE_ID_2,
          replacementText: 'Alice',
          conversationID: 'x',
        },
        {
          start: 39,
          length: 1,
          mentionAci: SERVICE_ID_2,
          replacementText: 'Bob',
          conversationID: 'x',
        },
        {
          start: 45,
          length: 1,
          mentionAci: SERVICE_ID_2,
          replacementText: 'Eve',
          conversationID: 'x',
        },
      ] as const;
      const { cleanedSnippet, bodyRanges: processedBodyRanges } =
        processBodyRangesForSearchResult({
          snippet:
            "<<truncation>>What's <<left>>going<<right>> with \uFFFC and<<truncation>>",
          body: "I'm just not sure \uFFFC. What's going with \uFFFC and \uFFFC?",
          bodyRanges,
        });

      assert.strictEqual(cleanedSnippet, "...What's going with \uFFFC and...");

      assert.lengthOf(processedBodyRanges, 2);
      assert.deepEqual(processedBodyRanges[0], {
        ...bodyRanges[1],
        start: 21,
      });
      assert.deepEqual(processedBodyRanges[1], {
        start: 10,
        length: 5,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });

    it('handles formatting that overlaps original snippet in interesting ways, with leading/trailing ...', () => {
      const bodyRanges = [
        {
          // Overlaps just start
          start: 0,
          length: 19,
          style: BodyRange.Style.BOLD,
        },
        {
          // Contains snippet entirely
          start: 0,
          length: 54,
          style: BodyRange.Style.ITALIC,
        },
        {
          // Contained by snippet
          start: 19,
          length: 10,
          style: BodyRange.Style.MONOSPACE,
        },
        {
          // Overlaps just end
          start: 29,
          length: 25,
          style: BodyRange.Style.STRIKETHROUGH,
        },
      ];
      const { cleanedSnippet, bodyRanges: processedBodyRanges } =
        processBodyRangesForSearchResult({
          snippet:
            '<<truncation>>playing with formatting in <<left>>fun<<right>> ways<<truncation>>',
          body: "We're playing with formatting in fun ways like you do!",
          bodyRanges,
        });

      assert.strictEqual(
        cleanedSnippet,
        '...playing with formatting in fun ways...'
      );

      assert.lengthOf(processedBodyRanges, 5);
      assert.deepEqual(processedBodyRanges[0], {
        // Still overlaps just start
        start: 3,
        length: 13,
        style: BodyRange.Style.BOLD,
      });
      assert.deepEqual(processedBodyRanges[1], {
        // Now overlaps full snippet
        start: 3,
        length: 35,
        style: BodyRange.Style.ITALIC,
      });
      assert.deepEqual(processedBodyRanges[2], {
        // Still contained by snippet
        start: 16,
        length: 10,
        style: BodyRange.Style.MONOSPACE,
      });
      assert.deepEqual(processedBodyRanges[3], {
        // Still overlaps just end of snippet
        start: 26,
        length: 12,
        style: BodyRange.Style.STRIKETHROUGH,
      });
      assert.deepEqual(processedBodyRanges[4], {
        start: 30,
        length: 3,
        displayStyle: DisplayStyle.SearchKeywordHighlight,
      });
    });
  });

  describe('applying ranges', () => {
    function mention(start: number, title: string): HydratedBodyRangeMention {
      return {
        start,
        length: 1,
        mentionAci: generateAci(),
        replacementText: title,
        conversationID: '',
      };
    }

    describe('applyRangesToText', () => {
      it('handles mentions', () => {
        const replacement = mention(3, 'jamie');
        const body = '012\uFFFC456';
        const result = applyRangeToText({ body, bodyRanges: [] }, replacement);
        assert.deepEqual(result, {
          body: '012@jamie456',
          bodyRanges: [],
        });
      });

      it('handles spoilers', () => {
        const replacement = style(3, 4, BodyRange.Style.SPOILER);
        const body = '012|45|789';
        const result = applyRangeToText({ body, bodyRanges: [] }, replacement);
        assert.deepEqual(result, {
          body: '012■■■■789',
          bodyRanges: [],
        });
      });

      describe('updating ranges', () => {
        describe('replacement same length', () => {
          function check(
            input: { start: number; length: number },
            expected: { start: number; length: number } | null
          ) {
            const replacement = style(3, 4, BodyRange.Style.SPOILER);
            const body = 'abc|ef|hij';
            const bodyRanges = [
              style(input.start, input.length, BodyRange.Style.BOLD),
            ];
            const result = applyRangeToText({ body, bodyRanges }, replacement);
            assert.deepEqual(result, {
              body: 'abc■■■■hij',
              bodyRanges:
                expected == null
                  ? []
                  : [
                      style(
                        expected.start,
                        expected.length,
                        BodyRange.Style.BOLD
                      ),
                    ],
            });
          }

          // start before
          it('start before, end before', () => {
            // abc|ef|hij -> abc■■■■hij
            // ^^         -> ^^
            // 0123456789 -> 0123456789
            check({ start: 0, length: 2 }, { start: 0, length: 2 });
          });
          it('start before, end at start', () => {
            // abc|ef|hij -> abc■■■■hij
            // ^^^        -> ^^^
            // 0123456789 -> 0123456789
            check({ start: 0, length: 3 }, { start: 0, length: 3 });
          });
          it('start before, end in middle', () => {
            // abc|ef|hij -> abc■■■■hij
            // ^^^^^      -> ^^^^^^^
            // 0123456789 -> 0123456789
            check({ start: 0, length: 5 }, { start: 0, length: 7 });
          });
          it('start before, end at end', () => {
            // abc|ef|hij -> abc■■■■hij
            // ^^^^^^^    -> ^^^^^^^
            // 0123456789 -> 0123456789
            check({ start: 0, length: 7 }, { start: 0, length: 7 });
          });
          it('start before, end after', () => {
            // abc|ef|hij -> abc■■■■hij
            // ^^^^^^^^^^ -> ^^^^^^^^^^
            // 0123456789 -> 0123456789
            check({ start: 0, length: 10 }, { start: 0, length: 10 });
          });

          // start at start
          it('start at start, end at start', () => {
            // abc|ef|hij -> abc■■■■hij
            //    \       -> null
            // 0123456789 -> 0123456789
            check({ start: 3, length: 0 }, null);
          });
          it('start at start, end in middle', () => {
            // abc|ef|hij -> abc■■■■hij
            //    ^^      -> null
            // 0123456789 -> 0123456789
            check({ start: 3, length: 2 }, null);
          });
          it('start at start, end at end', () => {
            // abc|ef|hij -> abc■■■■hij
            //    ^^^^    ->    ^^^^
            // 0123456789 -> 0123456789
            check({ start: 3, length: 4 }, { start: 3, length: 4 });
          });
          it('start at start, end after', () => {
            // abc|ef|hij -> abc■■■■hij
            //    ^^^^^^  ->    ^^^^^^
            // 0123456789 -> 0123456789
            check({ start: 3, length: 6 }, { start: 3, length: 6 });
          });

          // start in middle
          it('start in middle, end in middle', () => {
            // abc|ef|hij -> abc■■■■hij
            //     ^^     -> null
            // 0123456789 -> 0123456789
            check({ start: 4, length: 2 }, null);
          });
          it('start in middle, end at end', () => {
            // abc|ef|hij -> abc■■■■hij
            //     ^^^    -> null
            // 0123456789 -> 0123456789
            check({ start: 4, length: 3 }, null);
          });
          it('start in middle, end after', () => {
            // abc|ef|hij -> abc■■■■hij
            //     ^^^^^  ->    ^^^^^^
            // 0123456789 -> 0123456789
            check({ start: 4, length: 5 }, { start: 3, length: 6 });
          });

          // start at end
          it('start at end, end at end', () => {
            // abc|ef|hij -> abc■■■■hij
            //        \   -> null
            // 0123456789 -> 0123456789
            check({ start: 7, length: 0 }, null);
          });
          it('start at end, end after', () => {
            // abc|ef|hij -> abc■■■■hij
            //        ^^  ->        ^^
            // 0123456789 -> 0123456789
            check({ start: 7, length: 2 }, { start: 7, length: 2 });
          });

          // start after
          it('start after, end after', () => {
            // abc|ef|hij -> abc■■■■hij
            //         ^^ ->         ^^
            // 0123456789 -> 0123456789
            check({ start: 8, length: 2 }, { start: 8, length: 2 });
          });
        });

        describe('replacement shortens', () => {
          function check(
            input: { start: number; length: number },
            expected: { start: number; length: number } | null
          ) {
            const replacement = style(3, 5, BodyRange.Style.SPOILER);
            const body = 'abc|efg|ijk';
            const bodyRanges = [
              style(input.start, input.length, BodyRange.Style.BOLD),
            ];
            const result = applyRangeToText({ body, bodyRanges }, replacement);
            assert.deepEqual(result, {
              body: 'abc■■■■ijk',
              bodyRanges:
                expected == null
                  ? []
                  : [
                      style(
                        expected.start,
                        expected.length,
                        BodyRange.Style.BOLD
                      ),
                    ],
            });
          }

          // start before
          it('start before, end before', () => {
            // abc|efg|ijk -> abc■■■■ijk
            // ^^          -> ^^
            // 01234567890 -> 0123456789
            check({ start: 0, length: 2 }, { start: 0, length: 2 });
          });
          it('start before, end at start', () => {
            // abc|efg|ijk -> abc■■■■ijk
            // ^^^         -> ^^^
            // 01234567890 -> 0123456789
            check({ start: 0, length: 3 }, { start: 0, length: 3 });
          });
          it('start before, end in middle', () => {
            // abc|efg|ijk -> abc■■■■ijk
            // ^^^^^       -> ^^^^^^^
            // 01234567890 -> 0123456789
            check({ start: 0, length: 5 }, { start: 0, length: 7 });
          });
          it('start before, end at end', () => {
            // abc|efg|ijk -> abc■■■■ijk
            // ^^^^^^^^    -> ^^^^^^^
            // 01234567890 -> 0123456789
            check({ start: 0, length: 8 }, { start: 0, length: 7 });
          });
          it('start before, end after', () => {
            // abc|efg|ijk -> abc■■■■ijk
            // ^^^^^^^^^^^ -> ^^^^^^^^^^
            // 01234567890 -> 0123456789
            check({ start: 0, length: 11 }, { start: 0, length: 10 });
          });

          // start at start
          it('start at start, end at start', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //    \        -> null
            // 01234567890 -> 0123456789
            check({ start: 3, length: 0 }, null);
          });
          it('start at start, end in middle', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //    ^^       -> null
            // 01234567890 -> 0123456789
            check({ start: 3, length: 2 }, null);
          });
          it('start at start, end at end', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //    ^^^^^    ->   ^^^^
            // 01234567890 -> 0123456789
            check({ start: 3, length: 5 }, { start: 3, length: 4 });
          });
          it('start at start, end after', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //    ^^^^^^   ->    ^^^^^
            // 01234567890 -> 0123456789
            check({ start: 3, length: 6 }, { start: 3, length: 5 });
          });

          // start in middle
          it('start in middle, end in middle', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //     ^^      -> null
            // 01234567890 -> 0123456789
            check({ start: 4, length: 2 }, null);
          });
          it('start in middle, end at end', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //     ^^^     -> null
            // 01234567890 -> 0123456789
            check({ start: 4, length: 3 }, null);
          });
          it('start in middle, end after', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //     ^^^^^^  ->    ^^^^^^
            // 01234567890 -> 0123456789
            check({ start: 4, length: 6 }, { start: 3, length: 6 });
          });

          // start at end
          it('start at end, end at end', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //        \    -> null
            // 01234567890 -> 0123456789
            check({ start: 7, length: 0 }, null);
          });
          it('start at end, end after', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //         ^^  ->        ^^
            // 01234567890 -> 0123456789
            check({ start: 8, length: 2 }, { start: 7, length: 2 });
          });

          // start after
          it('start after, end after', () => {
            // abc|efg|ijk -> abc■■■■ijk
            //         ^^  ->        ^^
            // 01234567890 -> 0123456789
            check({ start: 8, length: 2 }, { start: 7, length: 2 });
          });
        });

        describe('replacement lengthens', () => {
          function check(
            input: { start: number; length: number },
            expected: { start: number; length: number } | null
          ) {
            const replacement = style(3, 3, BodyRange.Style.SPOILER);
            const body = 'abc|e|ghi';
            const bodyRanges = [
              style(input.start, input.length, BodyRange.Style.BOLD),
            ];
            const result = applyRangeToText({ body, bodyRanges }, replacement);
            assert.deepEqual(result, {
              body: 'abc■■■■ghi',
              bodyRanges:
                expected == null
                  ? []
                  : [
                      style(
                        expected.start,
                        expected.length,
                        BodyRange.Style.BOLD
                      ),
                    ],
            });
          }

          // start before
          it('start before, end before', () => {
            // abc|e|ghi -> abc■■■■ghi
            // ^^        -> ^^
            // 012345678 -> 0123456789
            check({ start: 0, length: 2 }, { start: 0, length: 2 });
          });
          it('start before, end at start', () => {
            // abc|e|ghi -> abc■■■■ghi
            // ^^^       -> ^^^
            // 012345678 -> 0123456789
            check({ start: 0, length: 3 }, { start: 0, length: 3 });
          });
          it('start before, end in middle', () => {
            // abc|e|ghi -> abc■■■■ghi
            // ^^^^^     -> ^^^^^^^
            // 012345678 -> 0123456789
            check({ start: 0, length: 5 }, { start: 0, length: 7 });
          });
          it('start before, end at end', () => {
            // abc|e|ghi -> abc■■■■ghi
            // ^^^^^^    -> ^^^^^^^
            // 012345678 -> 0123456789
            check({ start: 0, length: 6 }, { start: 0, length: 7 });
          });
          it('start before, end after', () => {
            // abc|e|ghi -> abc■■■■ghi
            // ^^^^^^^^^ -> ^^^^^^^^^^
            // 012345678 -> 0123456789
            check({ start: 0, length: 9 }, { start: 0, length: 10 });
          });

          // start at start
          it('start at start, end at start', () => {
            // abc|e|ghi -> abc■■■■ghi
            //    \      -> null
            // 012345678 -> 0123456789
            check({ start: 3, length: 0 }, null);
          });
          it('start at start, end in middle', () => {
            // abc|e|ghi -> abc■■■■ghi
            //    ^^     -> null
            // 012345678 -> 0123456789
            check({ start: 3, length: 2 }, null);
          });
          it('start at start, end at end', () => {
            // abc|e|ghi -> abc■■■■ghi
            //    ^^^    ->    ^^^^
            // 012345678 -> 0123456789
            check({ start: 3, length: 3 }, { start: 3, length: 4 });
          });
          it('start at start, end after', () => {
            // abc|e|ghi -> abc■■■■ghi
            //    ^^^^^^ ->    ^^^^^^^
            // 012345678 -> 0123456789
            check({ start: 3, length: 6 }, { start: 3, length: 7 });
          });

          // start in middle
          it('start in middle, end in middle', () => {
            // abc|e|ghi -> abc■■■■ghi
            //     ^     -> null
            // 012345678 -> 0123456789
            check({ start: 4, length: 1 }, null);
          });
          it('start in middle, end at end', () => {
            // abc|e|ghi -> abc■■■■ghi
            //     ^^    -> null
            // 012345678 -> 0123456789
            check({ start: 4, length: 2 }, null);
          });
          it('start in middle, end after', () => {
            // abc|e|ghi -> abc■■■■ghi
            //     ^^^^^ ->    ^^^^^^^
            // 012345678 -> 0123456789
            check({ start: 4, length: 5 }, { start: 3, length: 7 });
          });

          // start at end
          it('start at end, end at end', () => {
            // abc|e|ghi -> abc■■■■ghi
            //       \   -> null
            // 012345678 -> 0123456789
            check({ start: 6, length: 0 }, null);
          });
          it('start at end, end after', () => {
            // abc|e|ghi -> abc■■■■ghi
            //       ^^  ->        ^^
            // 012345678 -> 0123456789
            check({ start: 6, length: 2 }, { start: 7, length: 2 });
          });

          // start after
          it('start after, end after', () => {
            // abc|e|ghi -> abc■■■■ghi
            //        ^^ ->         ^^
            // 012345678 -> 0123456789
            check({ start: 7, length: 2 }, { start: 8, length: 2 });
          });
        });
      });
    });

    describe('applyRangesToText', () => {
      it('handles mentions, replaces in reverse order', () => {
        const body = "\uFFFC says \uFFFC, I'm here";
        const bodyRanges = [mention(0, 'jerry'), mention(7, 'fred')];
        assert.deepStrictEqual(
          applyRangesToText(
            { body, bodyRanges },
            {
              replaceMentions: true,
              replaceSpoilers: true,
            }
          ),
          {
            body: "@jerry says @fred, I'm here",
            bodyRanges: [],
          }
        );
      });

      it('handles spoilers, replaces in reverse order', () => {
        const body =
          "It's so cool when the balrog fight happens in Lord of the Rings!";
        const bodyRanges = [
          style(18, 16, BodyRange.Style.SPOILER),
          style(46, 17, BodyRange.Style.SPOILER),
        ];
        assert.deepStrictEqual(
          applyRangesToText(
            { body, bodyRanges },
            { replaceMentions: true, replaceSpoilers: true }
          ),
          { body: "It's so cool when ■■■■ happens in ■■■■!", bodyRanges: [] }
        );
      });

      it('handles mentions that are removed by spoilers', () => {
        const body =
          "The recipients of today's appreciation award are \uFFFC and \uFFFC!";
        const bodyRanges = [
          mention(49, 'alice'),
          mention(55, 'bob'),
          style(49, 7, BodyRange.Style.SPOILER),
        ];

        assert.deepStrictEqual(
          applyRangesToText(
            { body, bodyRanges },
            { replaceMentions: true, replaceSpoilers: true }
          ),
          {
            body: "The recipients of today's appreciation award are ■■■■!",
            bodyRanges: [],
          }
        );
      });

      it('handles applying mentions but not spoilers', () => {
        const body = 'before \uFFFC after';
        const bodyRanges = [
          mention(7, 'jamie'),
          style(0, 8, BodyRange.Style.BOLD),
          style(7, 1, BodyRange.Style.SPOILER),
          style(7, 6, BodyRange.Style.ITALIC),
        ];
        assert.deepStrictEqual(
          applyRangesToText(
            { body, bodyRanges },
            { replaceMentions: true, replaceSpoilers: false }
          ),
          {
            body: 'before @jamie after',
            bodyRanges: [
              style(0, 13, BodyRange.Style.BOLD),
              style(7, 6, BodyRange.Style.SPOILER),
              style(7, 11, BodyRange.Style.ITALIC),
            ],
          }
        );
      });
    });
    describe('trimMessageWhitespace', () => {
      it('returns exact inputs if no trimming needed', () => {
        const input = {
          body: '0123456789',
          bodyRanges: [
            style(0, 3, BodyRange.Style.BOLD),
            style(3, 3, BodyRange.Style.ITALIC),
            style(6, 4, BodyRange.Style.STRIKETHROUGH),
          ],
        };
        const result = trimMessageWhitespace(input);

        assert.strictEqual(result, input);
        assert.deepStrictEqual(result, input);
      });

      it('handles leading whitespace', () => {
        const input = {
          body: '          ten spaces',
          bodyRanges: [
            style(0, 5, BodyRange.Style.BOLD),
            style(0, 10, BodyRange.Style.SPOILER),
            style(6, 11, BodyRange.Style.ITALIC),
            style(10, 10, BodyRange.Style.STRIKETHROUGH),
            style(15, 5, BodyRange.Style.SPOILER),
          ],
        };
        const expected = {
          body: 'ten spaces',
          bodyRanges: [
            style(0, 7, BodyRange.Style.ITALIC),
            style(0, 10, BodyRange.Style.STRIKETHROUGH),
            style(5, 5, BodyRange.Style.SPOILER),
          ],
        };
        const result = trimMessageWhitespace(input);

        assert.notStrictEqual(result, input);
        assert.deepStrictEqual(result, expected);
      });
      it('handles leading whitespace partially covered by monospace', () => {
        const input = {
          body: '          ten spaces',
          bodyRanges: [
            style(0, 5, BodyRange.Style.BOLD),
            style(0, 6, BodyRange.Style.SPOILER),
            style(2, 10, BodyRange.Style.ITALIC),
            style(6, 11, BodyRange.Style.MONOSPACE),
            style(10, 10, BodyRange.Style.STRIKETHROUGH),
            style(15, 5, BodyRange.Style.SPOILER),
          ],
        };
        const expected = {
          body: '    ten spaces',
          bodyRanges: [
            style(0, 6, BodyRange.Style.ITALIC),
            style(0, 11, BodyRange.Style.MONOSPACE),
            style(4, 10, BodyRange.Style.STRIKETHROUGH),
            style(9, 5, BodyRange.Style.SPOILER),
          ],
        };
        const result = trimMessageWhitespace(input);

        assert.notStrictEqual(result, input);
        assert.deepStrictEqual(result, expected);
      });
      it('returns exact inputs when leading whitespace is entirely covered by monospace', () => {
        const input = {
          body: '          ten spaces',
          bodyRanges: [
            style(0, 5, BodyRange.Style.BOLD),
            style(0, 11, BodyRange.Style.MONOSPACE),
            style(10, 10, BodyRange.Style.STRIKETHROUGH),
            style(15, 5, BodyRange.Style.SPOILER),
          ],
        };
        const result = trimMessageWhitespace(input);

        assert.strictEqual(result, input);
        assert.deepStrictEqual(result, input);
      });

      it('handles trailing whitespace', () => {
        const input = {
          body: 'ten spaces after          ',
          bodyRanges: [
            style(0, 3, BodyRange.Style.BOLD),
            style(4, 6, BodyRange.Style.ITALIC),
            style(11, 15, BodyRange.Style.STRIKETHROUGH),
            style(15, 2, BodyRange.Style.BOLD),
            style(16, 10, BodyRange.Style.SPOILER),
            style(18, 4, BodyRange.Style.MONOSPACE),
          ],
        };
        const expected = {
          body: 'ten spaces after',
          bodyRanges: [
            style(0, 3, BodyRange.Style.BOLD),
            style(4, 6, BodyRange.Style.ITALIC),
            style(11, 5, BodyRange.Style.STRIKETHROUGH),
            style(15, 1, BodyRange.Style.BOLD),
          ],
        };
        const result = trimMessageWhitespace(input);

        assert.notStrictEqual(result, input);
        assert.deepStrictEqual(result, expected);
      });

      it('handles both trailing and leading whitespace', () => {
        const input = {
          body: '          0123456789          ',
          bodyRanges: [
            style(0, 10, BodyRange.Style.BOLD),
            style(8, 2, BodyRange.Style.MONOSPACE),
            style(10, 10, BodyRange.Style.STRIKETHROUGH),
            style(20, 10, BodyRange.Style.SPOILER),
          ],
        };
        const expected = {
          body: '  0123456789',
          bodyRanges: [
            style(0, 2, BodyRange.Style.BOLD),
            style(0, 2, BodyRange.Style.MONOSPACE),
            style(2, 10, BodyRange.Style.STRIKETHROUGH),
          ],
        };
        const result = trimMessageWhitespace(input);

        assert.notStrictEqual(result, input);
        assert.deepStrictEqual(result, expected);
      });
    });
  });
});
