// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type {
  HydratedBodyRangeMention,
  RangeNode,
} from '../../types/BodyRange';
import {
  BodyRange,
  DisplayStyle,
  applyRangeToText,
  applyRangesToText,
  collapseRangeTree,
  insertRange,
  processBodyRangesForSearchResult,
  trimMessageWhitespace,
} from '../../types/BodyRange';
import { generateAci } from '../../types/ServiceId';

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

  describe('insertRange', () => {
    it('inserts a single mention', () => {
      const result = insertRange({ start: 5, length: 1, ...mentionInfo }, []);

      assert.deepEqual(result, [
        {
          start: 5,
          length: 1,
          ranges: [],
          ...mentionInfo,
        },
      ]);
    });

    it('inserts a mention into a bold range', () => {
      const existingRanges = [
        {
          start: 5,
          length: 10,
          style: BodyRange.Style.BOLD,
          ranges: [],
        },
      ];

      const result = insertRange(
        { start: 7, length: 1, ...mentionInfo },
        existingRanges
      );

      // it nests the mention inside the bold range
      // and offsets the mention by the bold range start
      assert.deepEqual(result, [
        {
          start: 5,
          length: 10,
          style: BodyRange.Style.BOLD,
          ranges: [{ start: 2, length: 1, ranges: [], ...mentionInfo }],
        },
      ]);
    });

    it('intersects ranges by splitting up and nesting', () => {
      const ranges = [
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
      ];

      const result = ranges.reduce<ReadonlyArray<RangeNode>>(
        (acc, r) => insertRange(r, acc),
        []
      );

      assert.deepEqual(result, [
        {
          start: 5,
          length: 10,
          style: BodyRange.Style.BOLD,
          ranges: [
            { start: 5, length: 5, style: BodyRange.Style.ITALIC, ranges: [] },
          ],
        },
        { start: 15, length: 5, style: BodyRange.Style.ITALIC, ranges: [] },
      ]);
    });

    it('handles triple-nesting', () => {
      /* eslint-disable max-len */
      //                                                                 m            m
      // b                                      bs                                                          s
      // i                                                                                                             i
      // Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End',
      /* eslint-enable max-len */
      const ranges = [
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
      ];

      const result = ranges.reduce<ReadonlyArray<RangeNode>>(
        (acc, r) => insertRange(r, acc),
        []
      );

      assert.deepEqual(result, [
        {
          start: 0,
          length: 40,
          style: BodyRange.Style.BOLD,
          ranges: [
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.ITALIC,
              ranges: [],
            },
          ],
        },
        {
          start: 40,
          length: 71,
          style: BodyRange.Style.ITALIC,
          ranges: [
            {
              start: 0,
              length: 60,
              style: BodyRange.Style.STRIKETHROUGH,
              ranges: [
                {
                  start: 24,
                  length: 14,
                  style: BodyRange.Style.MONOSPACE,
                  ranges: [],
                },
              ],
            },
          ],
        },
      ]);
    });

    it('handles triple-nesting, with out-of-order inputs', () => {
      /* eslint-disable max-len */
      //                                                                 m            m
      // b                                      bs                                                          s
      // i                                                                                                             i
      // Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End',
      /* eslint-enable max-len */
      const ranges = [
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
      ];

      const result = ranges.reduce<ReadonlyArray<RangeNode>>(
        (acc, r) => insertRange(r, acc),
        []
      );

      assert.deepEqual(result, [
        {
          start: 0,
          length: 40,
          style: BodyRange.Style.ITALIC,
          ranges: [
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.BOLD,
              ranges: [],
            },
          ],
        },
        {
          start: 40,
          length: 24,
          style: BodyRange.Style.STRIKETHROUGH,
          ranges: [
            {
              start: 0,
              length: 24,
              style: BodyRange.Style.ITALIC,
              ranges: [],
            },
          ],
        },
        {
          start: 64,
          length: 14,
          style: BodyRange.Style.MONOSPACE,
          ranges: [
            {
              start: 0,
              length: 14,
              style: BodyRange.Style.STRIKETHROUGH,
              ranges: [
                {
                  start: 0,
                  length: 14,
                  style: BodyRange.Style.ITALIC,
                  ranges: [],
                },
              ],
            },
          ],
        },
        {
          start: 78,
          length: 22,
          style: BodyRange.Style.STRIKETHROUGH,
          ranges: [
            {
              start: 0,
              length: 22,
              style: BodyRange.Style.ITALIC,
              ranges: [],
            },
          ],
        },
        {
          start: 100,
          length: 11,
          style: BodyRange.Style.ITALIC,
          ranges: [],
        },
      ]);
    });
  });

  describe('collapseRangeTree', () => {
    it('handles a single mention', () => {
      const text = '--\uFFFC? What? Is that true?';
      const tree = [
        {
          start: 0,
          length: 10,
          style: BodyRange.Style.BOLD,
          ranges: [{ start: 2, length: 1, ranges: [], ...mentionInfo }],
        },
      ];
      const result = collapseRangeTree({ tree, text });

      assert.deepEqual(result, [
        {
          start: 0,
          length: 10,
          isBold: true,
          text: '--\uFFFC? What?',
          mentions: [{ start: 2, length: 1, ...mentionInfo }],
        },
        {
          start: 10,
          length: 14,
          text: ' Is that true?',
          mentions: [],
        },
      ]);
    });

    it('handles basic nested styles', () => {
      const text = '.... Bold I**** .... Basic Text';
      const tree = [
        {
          start: 5,
          length: 10,
          style: BodyRange.Style.BOLD,
          ranges: [
            { start: 5, length: 5, style: BodyRange.Style.ITALIC, ranges: [] },
          ],
        },
        { start: 15, length: 5, style: BodyRange.Style.ITALIC, ranges: [] },
      ];
      const result = collapseRangeTree({ tree, text });

      assert.deepEqual(result, [
        {
          start: 0,
          length: 5,
          text: '.... ',
          mentions: [],
        },
        {
          start: 5,
          length: 5,
          text: 'Bold ',
          isBold: true,
          mentions: [],
        },
        {
          start: 10,
          length: 5,
          text: 'I****',
          isBold: true,
          isItalic: true,
          mentions: [],
        },
        {
          start: 15,
          length: 5,
          text: ' ....',
          isItalic: true,
          mentions: [],
        },
        {
          start: 20,
          length: 11,
          text: ' Basic Text',
          mentions: [],
        },
      ]);
    });

    it('handles complex nested styles', () => {
      const text =
        'Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End';
      const tree = [
        {
          start: 0,
          length: 40,
          style: BodyRange.Style.BOLD,
          ranges: [
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.ITALIC,
              ranges: [],
            },
          ],
        },
        {
          start: 40,
          length: 71,
          style: BodyRange.Style.ITALIC,
          ranges: [
            {
              start: 0,
              length: 60,
              style: BodyRange.Style.STRIKETHROUGH,
              ranges: [
                {
                  start: 24,
                  length: 14,
                  style: BodyRange.Style.MONOSPACE,
                  ranges: [],
                },
              ],
            },
          ],
        },
      ];
      const result = collapseRangeTree({ tree, text });

      assert.deepEqual(result, [
        {
          start: 0,
          length: 40,
          isBold: true,
          isItalic: true,
          text: 'Italic Start and Bold Start ... Bold End',
          mentions: [],
        },
        {
          start: 40,
          length: 24,
          isItalic: true,
          isStrikethrough: true,
          text: 'Strikethrough Start ... ',
          mentions: [],
        },
        {
          start: 64,
          length: 14,
          isItalic: true,
          isStrikethrough: true,
          isMonospace: true,
          text: 'Monospace Pop!',
          mentions: [],
        },
        {
          start: 78,
          length: 22,
          isItalic: true,
          isStrikethrough: true,
          text: ' ... Strikethrough End',
          mentions: [],
        },
        {
          start: 100,
          length: 11,
          isItalic: true,
          text: ' Italic End',
          mentions: [],
        },
      ]);
    });

    it('handles complex nested styles (with a different arrangement)', () => {
      const text =
        'Italic Start and Bold Start ... Bold EndStrikethrough Start ... Monospace Pop! ... Strikethrough End Italic End';
      const tree = [
        {
          start: 0,
          length: 40,
          style: BodyRange.Style.ITALIC,
          ranges: [
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.BOLD,
              ranges: [],
            },
          ],
        },
        {
          start: 40,
          length: 24,
          style: BodyRange.Style.STRIKETHROUGH,
          ranges: [
            {
              start: 0,
              length: 24,
              style: BodyRange.Style.ITALIC,
              ranges: [],
            },
          ],
        },
        {
          start: 64,
          length: 14,
          style: BodyRange.Style.MONOSPACE,
          ranges: [
            {
              start: 0,
              length: 14,
              style: BodyRange.Style.STRIKETHROUGH,
              ranges: [
                {
                  start: 0,
                  length: 14,
                  style: BodyRange.Style.ITALIC,
                  ranges: [],
                },
              ],
            },
          ],
        },
        {
          start: 78,
          length: 22,
          style: BodyRange.Style.STRIKETHROUGH,
          ranges: [
            {
              start: 0,
              length: 22,
              style: BodyRange.Style.ITALIC,
              ranges: [],
            },
          ],
        },
        {
          start: 100,
          length: 11,
          style: BodyRange.Style.ITALIC,
          ranges: [],
        },
      ];

      const result = collapseRangeTree({ tree, text });

      assert.deepEqual(result, [
        {
          start: 0,
          length: 40,
          isBold: true,
          isItalic: true,
          text: 'Italic Start and Bold Start ... Bold End',
          mentions: [],
        },
        {
          start: 40,
          length: 24,
          isItalic: true,
          isStrikethrough: true,
          text: 'Strikethrough Start ... ',
          mentions: [],
        },
        {
          start: 64,
          length: 14,
          isItalic: true,
          isStrikethrough: true,
          isMonospace: true,
          text: 'Monospace Pop!',
          mentions: [],
        },
        {
          start: 78,
          length: 22,
          isItalic: true,
          isStrikethrough: true,
          text: ' ... Strikethrough End',
          mentions: [],
        },
        {
          start: 100,
          length: 11,
          isItalic: true,
          text: ' Italic End',
          mentions: [],
        },
      ]);
    });

    it('handles complex nested styles with embedded mentions', () => {
      const text =
        'Italic Start and Bold Start .\uFFFC. Bold EndStrikethrough Start .\uFFFC. Mono\uFFFCpace Pop! .\uFFFC. Strikethrough End Ital\uFFFCc End';
      const tree = [
        {
          start: 0,
          length: 40,
          style: BodyRange.Style.BOLD,
          ranges: [
            {
              start: 0,
              length: 40,
              style: BodyRange.Style.ITALIC,
              ranges: [
                {
                  start: 29,
                  length: 1,
                  ...mentionInfo,
                  replacementText: 'A',
                  ranges: [],
                },
              ],
            },
          ],
        },
        {
          start: 40,
          length: 71,
          style: BodyRange.Style.ITALIC,
          ranges: [
            {
              start: 0,
              length: 60,
              style: BodyRange.Style.STRIKETHROUGH,
              ranges: [
                {
                  start: 21,
                  length: 1,
                  ...mentionInfo,
                  replacementText: 'B',
                  ranges: [],
                },
                {
                  start: 24,
                  length: 14,
                  style: BodyRange.Style.MONOSPACE,
                  ranges: [
                    {
                      start: 4,
                      length: 1,
                      ...mentionInfo,
                      replacementText: 'C',
                      ranges: [],
                    },
                  ],
                },
                {
                  start: 40,
                  length: 1,
                  ...mentionInfo,
                  replacementText: 'D',
                  ranges: [],
                },
              ],
            },
            {
              start: 65,
              length: 1,
              ...mentionInfo,
              replacementText: 'E',
              ranges: [],
            },
          ],
        },
      ];
      const result = collapseRangeTree({ tree, text });

      assert.deepEqual(result, [
        {
          start: 0,
          length: 40,
          isBold: true,
          isItalic: true,
          text: 'Italic Start and Bold Start .\uFFFc. Bold End',
          mentions: [
            {
              start: 29,
              length: 1,
              ...mentionInfo,
              replacementText: 'A',
            },
          ],
        },
        {
          start: 40,
          length: 24,
          isItalic: true,
          isStrikethrough: true,
          text: 'Strikethrough Start .\uFFFc. ',
          mentions: [
            {
              start: 21,
              length: 1,
              ...mentionInfo,
              replacementText: 'B',
            },
          ],
        },
        {
          start: 64,
          length: 14,
          isItalic: true,
          isStrikethrough: true,
          isMonospace: true,
          text: 'Mono\uFFFcpace Pop!',
          mentions: [
            {
              start: 4,
              length: 1,
              ...mentionInfo,
              replacementText: 'C',
            },
          ],
        },
        {
          start: 78,
          length: 22,
          isItalic: true,
          isStrikethrough: true,
          text: ' .\uFFFc. Strikethrough End',
          mentions: [
            {
              start: 2,
              length: 1,
              ...mentionInfo,
              replacementText: 'D',
            },
          ],
        },
        {
          start: 100,
          length: 11,
          isItalic: true,
          text: ' Ital\uFFFcc End',
          mentions: [
            {
              start: 5,
              length: 1,
              ...mentionInfo,
              replacementText: 'E',
            },
          ],
        },
      ]);
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
      ];
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
