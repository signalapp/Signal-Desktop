// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  _hasEmojiLocalizer,
  _toEmojiCompletionLabel,
  _toEmojiCompletionQuery,
  _resetEmojiLocalizer,
  Emoji,
} from './emoji.std.ts';
import { assert } from './_internal/assert.std.tsx';

type EmojiEdgeCase = Readonly<{
  label: string;
  input: string;
  debug: string;
  isEmoji: boolean;
  isParent: boolean;
  isSkinToneVariant: boolean;
  codeUnits: number;
}>;

const EMOJI_EDGE_CASES: Array<EmojiEdgeCase> = [
  {
    label: 'Single code point in BMP with no VS',
    input: '☕',
    debug: 'U+2615',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 1,
  },
  {
    label: 'Single code point in astral plane as surrogate pair',
    input: '😀',
    debug: 'U+1F600',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 2,
  },
  {
    label: 'Text-default characters without VS16',
    input: '☺',
    debug: 'U+263A',
    isEmoji: false,
    isParent: false,
    isSkinToneVariant: false,
    codeUnits: 1,
  },
  {
    label: 'Text-default characters with VS16 to force emoji presentation',
    input: '☺️',
    debug: 'U+263A U+FE0F',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 2,
  },
  {
    label: 'Modifier sequence with base + fitzpatrick skin tone',
    input: '👋🏻',
    debug: 'U+1F44B U+1F3FB',
    isEmoji: true,
    isParent: false,
    isSkinToneVariant: true,
    codeUnits: 4,
  },
  {
    label: 'ZWJ sequence with no VS16',
    input: '👨‍👩‍👧',
    debug: 'U+1F468 U+200D U+1F469 U+200D U+1F467',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 8,
  },
  {
    label: 'ZWJ sequence with VS16 required mid-sequence',
    input: '🏳️‍🌈',
    debug: 'U+1F3F3 U+FE0F U+200D U+1F308',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 6,
  },
  {
    label: 'ZWJ sequence with BMP base + VS16 + ZWJ + astral',
    input: '❤️‍🔥',
    debug: 'U+2764 U+FE0F U+200D U+1F525',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 5,
  },
  {
    label: 'ZWJ sequence with trailing VS16',
    input: '🏴‍☠️',
    debug: 'U+1F3F4 U+200D U+2620 U+FE0F',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 5,
  },
  {
    label: 'ZWJ sequence with skin tone',
    input: '👨🏽‍💻',
    debug: 'U+1F468 U+1F3FD U+200D U+1F4BB',
    isEmoji: true,
    isParent: false,
    isSkinToneVariant: true,
    codeUnits: 7,
  },
  {
    label: 'Keycap sequence with digit + VS16 + enclosing keycap',
    input: '1️⃣',
    debug: 'U+0031 U+FE0F U+20E3',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 3,
  },
  {
    label: 'Keycap sequence with ASCII punctuation base',
    input: '#️⃣',
    debug: 'U+0023 U+FE0F U+20E3',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 3,
  },
  {
    label: 'Flag with regional indicator pair',
    input: '🇨🇦',
    debug: 'U+1F1E8 U+1F1E6',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 4,
  },
  {
    label: 'Flag with subdivision tag sequence',
    input: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    debug: 'U+1F3F4 U+E0067 U+E0062 U+E0073 U+E0063 U+E0074 U+E007F',
    isEmoji: true,
    isParent: true,
    isSkinToneVariant: false,
    codeUnits: 14,
  },
];

/**
 * Compares every edge case at once, so a failure shows the label of each case
 * that doesn't match.
 */
function checkEdgeCases<T>(
  actual: (edgeCase: EmojiEdgeCase) => T,
  expected: (edgeCase: EmojiEdgeCase) => T
): void {
  expect(
    EMOJI_EDGE_CASES.map(edgeCase => {
      return { label: edgeCase.label, value: actual(edgeCase) };
    })
  ).toStrictEqual(
    EMOJI_EDGE_CASES.map(edgeCase => {
      return { label: edgeCase.label, value: expected(edgeCase) };
    })
  );
}

/** Sets up the emoji locale for the rest of the current test */
function setupLocale(localeData: Emoji.EmojiLocaleData): void {
  expect(_hasEmojiLocalizer()).toBe(false);
  Emoji.setupLocale(localeData);
  onTestFinished(() => {
    _resetEmojiLocalizer();
  });
}

describe('Emoji', () => {
  function spyGetMatches() {
    type Next = ReturnType<typeof Emoji.getMatches>['next'];
    let spy: MockInstance<Next> | null = null;

    const getMatches = Emoji.getMatches;
    vi.spyOn(Emoji, 'getMatches')
      .mockImplementationOnce(input => {
        const iterator = getMatches(input);
        spy = vi.spyOn(iterator, 'next');
        return iterator;
      })
      .mockImplementation(() => {
        throw new Error('cannot call more than once in a test');
      });

    return {
      getNextCallCount() {
        return spy?.mock.calls.length ?? 0;
      },
    };
  }

  describe('Emoji.getDebugLabel()', () => {
    function check(input: string, expected: string) {
      expect(Emoji.getDebugLabel(input)).toBe(expected);
    }

    test('formats unicode sequences', () => {
      check('a', 'U+0061');
      check('abc', 'U+0061 U+0062 U+0063');
      check('😀', 'U+1F600');
      check('❤️', 'U+2764 U+FE0F');
      check('a😀b', 'U+0061 U+1F600 U+0062');
    });

    test('truncates to the first 12 UTF-16 code units', () => {
      check(
        'abcdefghijklmnop',
        'U+0061 U+0062 U+0063 U+0064 U+0065 U+0066 U+0067 U+0068 U+0069 U+006A U+006B U+006C'
      );
    });
  });

  describe('Emoji.getDisplayLabel()', () => {
    function setup() {
      setupLocale([{ emoji: '😄', rank: 1, tags: ['not-a-default-tag'] }]);
    }

    function check(input: string, expected: string) {
      assert(Emoji.isEmoji(input));
      expect(Emoji.getDisplayLabel(input)).toBe(expected);
    }

    test('falls back to default english short names when no locale is setup', () => {
      check('😄', 'smile');
    });

    test('matches localized short names', () => {
      setup();
      check('😄', 'not-a-default-tag');
    });

    test('falls back to default english short names locale doesnt contain emoji', () => {
      setup();
      check('👋', 'wave');
    });
  });

  describe('Emoji.getCompletionLabel()', () => {
    function setup() {
      setupLocale([
        { emoji: '😄', rank: 1, tags: ['this-is_not, ñormalîzed'] },
      ]);
    }

    function check(input: string, expected: string) {
      assert(Emoji.isEmoji(input));
      expect(Emoji.getCompletionLabel(input)).toBe(expected);
    }

    test('falls back to default english short names when no locale is setup', () => {
      check('😄', 'smile');
    });

    test('matches localized short names', () => {
      setup();
      check('😄', 'this_is_not_ñormalîzed');
    });

    test('falls back to default english short names locale doesnt contain emoji', () => {
      setup();
      check('👋', 'wave');
    });

    test('leaves :-1: alone', () => {
      check('👎', '-1');
    });
  });

  describe('Emoji.isEmoji()', () => {
    function check(input: string, expected: boolean) {
      expect(Emoji.isEmoji(input)).toBe(expected);
    }

    test('returns true for a single emoji', () => {
      check('😀', true);
      check('❤️', true);
      check('👋🏻', true);
    });

    test('returns false for plain text', () => {
      check('', false);
      check('a', false);
      check('hello', false);
    });

    test('returns false when an emoji is mixed with other text', () => {
      check('a😀', false);
      check('😀b', false);
      check('😀😀', false);
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Emoji.isEmoji(edgeCase.input),
        edgeCase => edgeCase.isEmoji
      );
    });
  });

  describe('Emoji.isParent()', () => {
    function check(input: string, expected: boolean) {
      expect(Emoji.isParent(input)).toBe(expected);
    }

    test('returns true for parent emoji', () => {
      check('😀', true);
      check('👋', true);
    });

    test('returns false for skin tone variants', () => {
      check('👋🏻', false);
    });

    test('returns false for non-emoji', () => {
      check('', false);
      check('   ', false);
      check('abc', false);
      check('abc👋', false);
    });

    test('returns false for multiple emojis', () => {
      check('👋👋', false);
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Emoji.isParent(edgeCase.input),
        edgeCase => edgeCase.isParent
      );
    });
  });

  describe('Emoji.isSkinToneVariant()', () => {
    function check(input: string, expected: boolean) {
      expect(Emoji.isSkinToneVariant(input)).toBe(expected);
    }

    test('returns true for skin tone variants', () => {
      check('👋🏻', true);
      check('👋🏿', true);
    });

    test('returns false for parent emoji', () => {
      check('😀', false);
      check('👋', false);
    });

    test('returns false for non-emoji', () => {
      check('', false);
      check('   ', false);
      check('abc', false);
      check('abc👋🏻', false);
    });

    test('returns false for multiple emojis', () => {
      check('👋🏻👋🏿', false);
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Emoji.isSkinToneVariant(edgeCase.input),
        edgeCase => edgeCase.isSkinToneVariant
      );
    });
  });

  describe('Emoji.matchShortName()', () => {
    function setup() {
      setupLocale([{ emoji: '😄', rank: 1, tags: ['not-a-default-tag'] }]);
    }

    function check(input: string, expected: string | null) {
      expect(Emoji.matchShortName(input)).toBe(expected);
    }

    test('falls back to default english short names when no locale is setup', () => {
      check('smile', '😄');
    });

    test('returns null for inputs that are not exactly a short name', () => {
      check('', null);
      check('   ', null);
      check('s', null);
      check('smil', null);
      check('smiles', null);
      check('smile ', null);
      check(' smile', null);
    });

    test('matches localized short names', () => {
      setup();
      check('not-a-default-tag', '😄');
    });

    test('falls back to default english short names when doesnt match locale', () => {
      setup();
      check('smile', '😄');
    });
  });

  describe('Emoji.getCategoryParents()', () => {
    function check(
      category: Emoji.Category,
      includes: string,
      excludes: string
    ) {
      assert(Emoji.isParent(includes));
      assert(Emoji.isParent(excludes));
      const results = Emoji.getCategoryParents(category);
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain(includes);
      expect(results).not.toContain(excludes);
    }

    test('returns the parents for a category', () => {
      check(Emoji.Category.SMILIES_AND_PEOPLE, '😀', '🍤');
      check(Emoji.Category.FOOD_AND_DRINK, '🍤', '😀');
    });
  });

  describe('Emoji.getParent()', () => {
    function check(input: string, expected: string) {
      assert(Emoji.isEmoji(input));
      assert(Emoji.isEmoji(expected));
      expect(Emoji.getParent(input)).toBe(expected);
    }

    test('returns the input when given a parent', () => {
      check('😀', '😀');
      check('👋', '👋');
    });

    test('returns the parent for a skin tone variant', () => {
      check('👋🏻', '👋');
      check('👋🏿', '👋');
    });

    test('throws for non-emoji input', () => {
      expect(() => Emoji.getParent('a' as unknown as Emoji.Parent)).toThrow(
        'Expected "a" to be a parent'
      );
    });
  });

  describe('Emoji.hasSkinToneVariants()', () => {
    function check(input: string, expected: boolean) {
      assert(Emoji.isParent(input));
      expect(Emoji.hasSkinToneVariants(input)).toBe(expected);
    }

    test('returns true for emoji with skin tone variants', () => {
      check('👋', true);
      check('👍', true);
    });

    test('returns false for emoji without skin tone variants', () => {
      check('😀', false);
      check('❤️', false);
    });
  });

  describe('Emoji.getVariant()', () => {
    function check(parent: string, skinTone: Emoji.SkinTone, variant: string) {
      assert(Emoji.isParent(parent));
      expect(Emoji.getVariant(parent, skinTone)).toBe(variant);
    }

    test('returns the parent emoji unchanged with SkinTone.None', () => {
      check('👋', Emoji.SkinTone.None, '👋');
      check('😀', Emoji.SkinTone.None, '😀');
    });

    test('returns the variant emoji when a skin tone is available', () => {
      check('👋', Emoji.SkinTone.Type1, '👋🏻');
      check('👋', Emoji.SkinTone.Type5, '👋🏿');
    });

    test('returns the parent when an emoji has no skin tone variants', () => {
      check('😀', Emoji.SkinTone.Type3, '😀');
    });
  });

  describe('Emoji.iterateAllVariants()', () => {
    function getAllVariants(): ReadonlyArray<string> {
      return Array.from(Emoji.iterateAllVariants());
    }

    test('yields each emoji followed by its skin tone variants', () => {
      const variants = getAllVariants();
      const start = variants.indexOf('👋');
      expect(variants.slice(start, start + 6)).toStrictEqual([
        '👋',
        '👋🏻',
        '👋🏼',
        '👋🏽',
        '👋🏾',
        '👋🏿',
      ]);
    });

    test('yields emoji without skin tone variants once', () => {
      expect(
        getAllVariants().filter(variant => variant === '😀')
      ).toStrictEqual(['😀']);
    });

    test('yields every variant once', () => {
      const variants = getAllVariants();
      expect(new Set(variants).size).toBe(variants.length);
    });
  });

  describe('Emoji.replaceEmojiWithSpaces()', () => {
    function check(input: string, expected: string) {
      expect(Emoji.replaceEmojiWithSpaces(input)).toBe(expected);
    }

    test('returns text-only strings unchanged', () => {
      check('', '');
      check('   ', '   ');
      check('hello', 'hello');
      check('   hello   ', '   hello   ');
    });

    test('returns text with emojis replaced with spaces of the same UTF-16 length', () => {
      check('😀', '  ');
      check('😎', '  ');
      check('a😀b', 'a  b');
      check('👋🏻', '    ');
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Emoji.replaceEmojiWithSpaces(`a${edgeCase.input}b`),
        edgeCase => `a${' '.repeat(edgeCase.codeUnits)}b`
      );
    });
  });

  describe('Emoji.stripEmojiFromText()', () => {
    function check(input: string, expected: string) {
      expect(Emoji.stripEmojiFromText(input)).toBe(expected);
    }

    test('returns text-only strings unchanged', () => {
      check('', '');
      check('   ', '   ');
      check('hello', 'hello');
      check('   hello   ', '   hello   ');
    });

    test('returns text with emojis stripped away', () => {
      check('a😀b', 'ab');
      check('hi 👋🏻 there', 'hi  there');
      check('😀😀', '');
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Emoji.stripEmojiFromText(`a${edgeCase.input}b`),
        () => 'ab'
      );
    });
  });

  describe('Emoji.getMatches()', () => {
    function check(input: string, expected: Array<Emoji.Match>) {
      expect(Array.from(Emoji.getMatches(input))).toStrictEqual(expected);
    }

    function getExpectedMatches(edgeCase: EmojiEdgeCase): Array<Emoji.Match> {
      return edgeCase.isEmoji ? [match(edgeCase.input, 0)] : [];
    }

    function match(emoji: string, offset: number): Emoji.Match {
      assert(Emoji.isEmoji(emoji));
      return { emoji: Emoji.ignorePreferredSkinTone(emoji), offset };
    }

    test('yields nothing for an empty string', () => {
      check('', []);
      check('   ', []);
    });

    test('yields nothing for a text-only string', () => {
      check('hello', []);
    });

    test('yields emoji matches', () => {
      check('😀', [match('😀', 0)]);
      check('😀😀😀', [match('😀', 0), match('😀', 2), match('😀', 4)]);
    });

    test('yields emojis inside mixed text', () => {
      check('a😀b👋🏻c', [match('😀', 1), match('👋🏻', 4)]);
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Array.from(Emoji.getMatches(edgeCase.input)),
        edgeCase => getExpectedMatches(edgeCase)
      );
    });
  });

  describe('Emoji.getSegments()', () => {
    function check(input: string, expected: Array<Emoji.Segment>) {
      expect(Array.from(Emoji.getSegments(input))).toStrictEqual(expected);
    }

    function text(value: string, offset: number): Emoji.TextSegment {
      return { kind: 'text', value, offset };
    }

    function emoji(value: string, offset: number): Emoji.EmojiSegment {
      assert(Emoji.isEmoji(value));
      return {
        kind: 'emoji',
        value: Emoji.ignorePreferredSkinTone(value),
        offset,
      };
    }

    test('doesnt call Emoji.getMatches() for empty input', () => {
      const spy = vi.spyOn(Emoji, 'getMatches');
      expect(Array.from(Emoji.getSegments(''))).toStrictEqual([text('', 0)]);
      expect(spy).not.toHaveBeenCalled();

      expect(Array.from(Emoji.getSegments('  '))).toStrictEqual([
        text('  ', 0),
      ]);
      expect(spy).not.toHaveBeenCalled();
    });

    test('only calls Emoji.getMatches().next() while requesting items', () => {
      const getMatchesSpy = spyGetMatches();
      const iterator = Emoji.getSegments('a😀b😀c😀d😀e');

      expect(getMatchesSpy.getNextCallCount()).toBe(0);

      function checkNext(value: string, count: number) {
        expect(iterator.next().value?.value).toBe(value);
        expect(getMatchesSpy.getNextCallCount()).toBe(count);
      }

      // Note: Only calls getMatches().next() when searching for the next emoji
      checkNext('a', 1);
      checkNext('😀', 1);
      checkNext('b', 2);
      checkNext('😀', 2);
      checkNext('c', 3);
      checkNext('😀', 3);
    });

    test('yields an empty string', () => {
      check('', [text('', 0)]);
    });

    test('yields a whitespace-only string', () => {
      check('  ', [text('  ', 0)]);
    });

    test('yields a single text segment', () => {
      check('abc', [text('abc', 0)]);
    });

    test('yields a single emoji segment', () => {
      check('😀', [emoji('😀', 0)]);
    });

    test('yields multiple emoji segments', () => {
      check('😀😀😀', [emoji('😀', 0), emoji('😀', 2), emoji('😀', 4)]);
    });

    test('yields leading text before emoji', () => {
      check('abc😀', [text('abc', 0), emoji('😀', 3)]);
    });

    test('yields trailing text after emoji', () => {
      check('😀abc', [emoji('😀', 0), text('abc', 2)]);
      check('abc😀😀😀def', [
        text('abc', 0),
        emoji('😀', 3),
        emoji('😀', 5),
        emoji('😀', 7),
        text('def', 9),
      ]);
    });

    test('yields text in between emoji', () => {
      check('😀abc😀', [emoji('😀', 0), text('abc', 2), emoji('😀', 5)]);
    });
  });

  describe('Emoji.isLoneEmoji()', () => {
    function check(input: string, expected: boolean) {
      expect(Emoji.isLoneEmoji(input)).toBe(expected);
    }

    test('returns true for a single emoji', () => {
      check('😀', true);
      check('👋🏻', true);
    });

    test('returns false for empty input', () => {
      check('', false);
      check('   ', false);
    });

    test('returns false for text-only', () => {
      check('hello', false);
    });

    test('returns false for multiple emoji', () => {
      check('😀😀', false);
    });

    test('returns false with mixed text and emoji', () => {
      check('😀 a', false);
    });

    test('returns false with whitespace', () => {
      check('😀 ', false);
      check(' 😀', false);
      check('😀\n', false);
    });

    test('handles EMOJI_EDGE_CASES', () => {
      checkEdgeCases(
        edgeCase => Emoji.isLoneEmoji(edgeCase.input),
        edgeCase => edgeCase.isEmoji
      );
    });
  });

  describe('Emoji.getJumboEmojiCount()', () => {
    function check(input: string, expected: Emoji.JumboEmojiCount) {
      expect(Emoji.getJumboEmojiCount(input)).toBe(expected);
    }

    const MAX = Emoji.MAX_JUMBO_EMOJI_COUNT;

    test('returns null for empty input', () => {
      check('', null);
    });

    test('returns null for text-only input', () => {
      check('hello', null);
    });

    test('returns count of single emoji', () => {
      check('😀', 1);
    });

    test('returns count of multiple emojis', () => {
      check('😀😀😀', 3);
    });

    test('returns count of max emojis', () => {
      check('😀😀😀😀😀', MAX);
    });

    test('returns null over max emojis', () => {
      check('😀'.repeat(MAX + 1), null);
    });

    test('returns null for mixed text and emoji', () => {
      check('😀a', null);
      check('a😀', null);
    });

    test('returns count of emoji with spaces', () => {
      check(' 😀 ', 1);
      check('😀 😀', 2);
      check('😀   😀', 2);
      check('😀\n😀', 2);
    });
  });

  describe('_toEmojiCompletionDisplay', () => {
    function check(input: string, expected: string) {
      expect(_toEmojiCompletionLabel(input as Emoji.ShortName)).toBe(expected);
    }

    test('normalizes misc chars', () => {
      check('foo bar', 'foo_bar');
      check('foo,bar', 'foo_bar');
      check('foo_bar', 'foo_bar');
      check('foo-bar', 'foo_bar');
    });

    test('normalizes multiple misc chars', () => {
      check('foo, _-bar', 'foo_bar');
    });

    test('leaves diacritics', () => {
      check('ñ', 'ñ');
    });

    test('lowercases', () => {
      check('N', 'n');
      check('Ñ', 'ñ');
    });

    test('leaves :-1: alone', () => {
      check('-1', '-1');
    });
  });

  describe('_normalizeShortNameCompletionQuery', () => {
    function check(input: string, expected: string) {
      expect(_toEmojiCompletionQuery(input as Emoji.ShortName)).toBe(expected);
    }

    test('normalizes misc chars', () => {
      check('foo bar', 'foo bar');
      check('foo,bar', 'foo bar');
      check('foo_bar', 'foo bar');
      check('foo-bar', 'foo bar');
    });

    test('normalizes multiple misc chars', () => {
      check('foo, _-bar', 'foo bar');
    });

    test('replaces diacritics', () => {
      check('ñ', 'n');
    });

    test('lowercases', () => {
      check('N', 'n');
      check('Ñ', 'n');
    });

    test('leaves :-1: alone', () => {
      check('-1', '-1');
    });
  });

  describe('search', () => {
    function setup() {
      setupLocale([{ emoji: '😀', rank: 1, tags: ['not-a-default-tag'] }]);
    }

    function check(input: string, expected: Array<string>) {
      expect(
        Emoji.search(input).map(emoji => {
          return Emoji.getCompletionLabel(emoji);
        })
      ).toStrictEqual(expected);
    }

    test('returns nothing for empty string', () => {
      check('', []);
      check(' ', []);
      check('   ', []);
    });

    test('falls back to default english short names when no locale is setup', () => {
      check('grinning', ['grinning', 'star_struck', 'zany_face']);
    });

    test('searches emoticons', () => {
      check(':D', ['grinning', 'smile']);
    });

    test('matches localized short names', () => {
      setup();
      check('not a default tag', ['not_a_default_tag']);
    });

    test('falls back to default english short names locale doesnt contain emoji', () => {
      setup();
      check('wave', ['wave']);
    });

    test('searches english short names even when locale contains emoji', () => {
      setup();
      check('grinning', ['not_a_default_tag', 'star_struck', 'zany_face']);
    });

    test('searches emoticons when a locale is setup', () => {
      setup();
      check(':D', ['not_a_default_tag']);
    });

    test('ranks primary short name above aliases on prefix matches', () => {
      setupLocale([
        {
          emoji: '🤔',
          rank: 26,
          tags: ['thinking face', 'ponder', 'wondering'],
        },
        {
          emoji: '😔',
          rank: 34,
          tags: ['pensive', 'sad', 'thinking'],
        },
      ]);
      const results = Emoji.search('thinkin').map(emoji => {
        return Emoji.getCompletionLabel(emoji);
      });
      expect(results[0]).toBe('thinking_face');
    });

    test('ranks alt prefix matches above fuzzy matches', () => {
      const term = 'thisshouldnotmatchanydefaultemojishortname';
      const prefix = `${term}andhereissomemoretext`;
      const fuzzy = `fuzzy-${term}`;

      setupLocale([
        // Prefix Match: Default Short Name
        { emoji: '1️⃣', rank: 4, tags: [prefix, 'ignore'] },
        // Prefix Match: Alt Short Name
        { emoji: '2️⃣', rank: 3, tags: ['ignore', prefix] },
        // Fuzzy Match: Default Short Name
        { emoji: '3️⃣', rank: 2, tags: [fuzzy, 'ignore'] },
        // Fuzzy Match: Alt Short Name
        { emoji: '4️⃣', rank: 1, tags: ['ignore', fuzzy] },
      ]);
      const results = Emoji.search(term).map(emoji => {
        return Emoji.getDefaultVariant(emoji);
      });
      expect(results).toStrictEqual(['1️⃣', '2️⃣', '3️⃣', '4️⃣']);
    });
  });
});
