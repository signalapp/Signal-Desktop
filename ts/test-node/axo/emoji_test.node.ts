// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import {
  _hasEmojiLocalizer,
  _toEmojiCompletionLabel,
  _toEmojiCompletionQuery,
  _resetEmojiLocalizer,
  Emoji,
} from '../../axo/emoji.std.ts';
import type { SinonSandbox, SinonSpiedMember } from 'sinon';
import sinon from 'sinon';

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

describe('Emoji', () => {
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    assert.equal(_hasEmojiLocalizer(), false);
  });

  afterEach(() => {
    sandbox.restore();
    _resetEmojiLocalizer();
  });

  function spyGetMatches() {
    type Next = ReturnType<typeof Emoji.getMatches>['next'];
    let spy: SinonSpiedMember<Next>;

    const stub = sandbox.stub(Emoji, 'getMatches');

    stub.onCall(0).callsFake(input => {
      const iterator = stub.wrappedMethod(input);
      spy = sandbox.spy(iterator, 'next');
      return iterator;
    });

    stub.throws('cannot call more than once in a test');

    return {
      getNextCallCount() {
        return spy?.callCount ?? 0;
      },
    };
  }

  describe('Emoji.getDebugLabel()', () => {
    function check(input: string, expected: string) {
      assert.equal(Emoji.getDebugLabel(input), expected);
    }

    it('formats unicode sequences', () => {
      check('a', 'U+0061');
      check('abc', 'U+0061 U+0062 U+0063');
      check('😀', 'U+1F600');
      check('❤️', 'U+2764 U+FE0F');
      check('a😀b', 'U+0061 U+1F600 U+0062');
    });

    it('truncates to the first 12 UTF-16 code units', () => {
      check(
        'abcdefghijklmnop',
        'U+0061 U+0062 U+0063 U+0064 U+0065 U+0066 U+0067 U+0068 U+0069 U+006A U+006B U+006C'
      );
    });
  });

  describe('Emoji.getDisplayLabel()', () => {
    function setup() {
      Emoji.setupLocale([
        { emoji: '😄', rank: 1, tags: ['not-a-default-tag'] },
      ]);
    }

    function check(input: string, expected: string) {
      assert(Emoji.isEmoji(input));
      assert.equal(Emoji.getDisplayLabel(input), expected);
    }

    it('falls back to default english short names when no locale is setup', () => {
      check('😄', 'smile');
    });

    it('matches localized short names', () => {
      setup();
      check('😄', 'not-a-default-tag');
    });

    it('falls back to default english short names locale doesnt contain emoji', () => {
      setup();
      check('👋', 'wave');
    });
  });

  describe('Emoji.getCompletionLabel()', () => {
    function setup() {
      Emoji.setupLocale([
        { emoji: '😄', rank: 1, tags: ['this-is_not, ñormalîzed'] },
      ]);
    }

    function check(input: string, expected: string) {
      assert(Emoji.isEmoji(input));
      assert.equal(Emoji.getCompletionLabel(input), expected);
    }

    it('falls back to default english short names when no locale is setup', () => {
      check('😄', 'smile');
    });

    it('matches localized short names', () => {
      setup();
      check('😄', 'this_is_not_ñormalîzed');
    });

    it('falls back to default english short names locale doesnt contain emoji', () => {
      setup();
      check('👋', 'wave');
    });

    it('leaves :-1: alone', () => {
      check('👎', '-1');
    });
  });

  describe('Emoji.isEmoji()', () => {
    function check(input: string, expected: boolean) {
      assert.equal(Emoji.isEmoji(input), expected);
    }

    it('returns true for a single emoji', () => {
      check('😀', true);
      check('❤️', true);
      check('👋🏻', true);
    });

    it('returns false for plain text', () => {
      check('', false);
      check('a', false);
      check('hello', false);
    });

    it('returns false when an emoji is mixed with other text', () => {
      check('a😀', false);
      check('😀b', false);
      check('😀😀', false);
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(test.input, test.isEmoji);
        });
      }
    });
  });

  describe('Emoji.isParent()', () => {
    function check(input: string, expected: boolean) {
      assert.equal(Emoji.isParent(input), expected);
    }

    it('returns true for parent emoji', () => {
      check('😀', true);
      check('👋', true);
    });

    it('returns false for skin tone variants', () => {
      check('👋🏻', false);
    });

    it('returns false for non-emoji', () => {
      check('', false);
      check('   ', false);
      check('abc', false);
      check('abc👋', false);
    });

    it('returns false for multiple emojis', () => {
      check('👋👋', false);
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(test.input, test.isParent);
        });
      }
    });
  });

  describe('Emoji.isSkinToneVariant()', () => {
    function check(input: string, expected: boolean) {
      assert.equal(Emoji.isSkinToneVariant(input), expected);
    }

    it('returns true for skin tone variants', () => {
      check('👋🏻', true);
      check('👋🏿', true);
    });

    it('returns false for parent emoji', () => {
      check('😀', false);
      check('👋', false);
    });

    it('returns false for non-emoji', () => {
      check('', false);
      check('   ', false);
      check('abc', false);
      check('abc👋🏻', false);
    });

    it('returns false for multiple emojis', () => {
      check('👋🏻👋🏿', false);
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(test.input, test.isSkinToneVariant);
        });
      }
    });
  });

  describe('Emoji.matchShortName()', () => {
    function setup() {
      Emoji.setupLocale([
        { emoji: '😄', rank: 1, tags: ['not-a-default-tag'] },
      ]);
    }

    function check(input: string, expected: string | null) {
      assert.equal(Emoji.matchShortName(input), expected);
    }

    it('falls back to default english short names when no locale is setup', () => {
      check('smile', '😄');
    });

    it('returns null for inputs that are not exactly a short name', () => {
      check('', null);
      check('   ', null);
      check('s', null);
      check('smil', null);
      check('smiles', null);
      check('smile ', null);
      check(' smile', null);
    });

    it('matches localized short names', () => {
      setup();
      check('not-a-default-tag', '😄');
    });

    it('falls back to default english short names when doesnt match locale', () => {
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
      assert(results.length > 0);
      assert(results.includes(includes));
      assert(!results.includes(excludes));
    }

    it('returns the parents for a category', () => {
      check(Emoji.Category.SMILIES_AND_PEOPLE, '😀', '🍤');
      check(Emoji.Category.FOOD_AND_DRINK, '🍤', '😀');
    });
  });

  describe('Emoji.getParent()', () => {
    function check(input: string, expected: string) {
      assert(Emoji.isEmoji(input));
      assert(Emoji.isEmoji(expected));
      assert.equal(Emoji.getParent(input), expected);
    }

    it('returns the input when given a parent', () => {
      check('😀', '😀');
      check('👋', '👋');
    });

    it('returns the parent for a skin tone variant', () => {
      check('👋🏻', '👋');
      check('👋🏿', '👋');
    });

    it('throws for non-emoji input', () => {
      assert.throws(() => Emoji.getParent('a' as unknown as Emoji.Parent));
    });
  });

  describe('Emoji.hasSkinToneVariants()', () => {
    function check(input: string, expected: boolean) {
      assert(Emoji.isParent(input));
      assert.equal(Emoji.hasSkinToneVariants(input), expected);
    }

    it('returns true for emoji with skin tone variants', () => {
      check('👋', true);
      check('👍', true);
    });

    it('returns false for emoji without skin tone variants', () => {
      check('😀', false);
      check('❤️', false);
    });
  });

  describe('Emoji.getVariant()', () => {
    function check(parent: string, skinTone: Emoji.SkinTone, variant: string) {
      assert(Emoji.isParent(parent));
      assert.equal(Emoji.getVariant(parent, skinTone), variant);
    }

    it('returns the parent emoji unchanged with SkinTone.None', () => {
      check('👋', Emoji.SkinTone.None, '👋');
      check('😀', Emoji.SkinTone.None, '😀');
    });

    it('returns the variant emoji when a skin tone is available', () => {
      check('👋', Emoji.SkinTone.Type1, '👋🏻');
      check('👋', Emoji.SkinTone.Type5, '👋🏿');
    });

    it('returns the parent when an emoji has no skin tone variants', () => {
      check('😀', Emoji.SkinTone.Type3, '😀');
    });
  });

  describe('Emoji.iterateAllVariants()', () => {
    // ...
  });

  describe('Emoji.replaceEmojiWithSpaces()', () => {
    function check(input: string, expected: string) {
      assert.equal(Emoji.replaceEmojiWithSpaces(input), expected);
    }

    it('returns text-only strings unchanged', () => {
      check('', '');
      check('   ', '   ');
      check('hello', 'hello');
      check('   hello   ', '   hello   ');
    });

    it('returns text with emojis replaced with spaces of the same UTF-16 length', () => {
      check('😀', '  ');
      check('😎', '  ');
      check('a😀b', 'a  b');
      check('👋🏻', '    ');
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(`a${test.input}b`, `a${' '.repeat(test.codeUnits)}b`);
        });
      }
    });
  });

  describe('Emoji.stripEmojiFromText()', () => {
    function check(input: string, expected: string) {
      assert.equal(Emoji.stripEmojiFromText(input), expected);
    }

    it('returns text-only strings unchanged', () => {
      check('', '');
      check('   ', '   ');
      check('hello', 'hello');
      check('   hello   ', '   hello   ');
    });

    it('returns text with emojis stripped away', () => {
      check('a😀b', 'ab');
      check('hi 👋🏻 there', 'hi  there');
      check('😀😀', '');
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(`a${test.input}b`, 'ab');
        });
      }
    });
  });

  describe('Emoji.getMatches()', () => {
    function check(input: string, expected: Array<Emoji.Match>) {
      assert.deepEqual(Array.from(Emoji.getMatches(input)), expected);
    }

    function match(emoji: string, offset: number): Emoji.Match {
      assert(Emoji.isEmoji(emoji));
      return { emoji: Emoji.ignorePreferredSkinTone(emoji), offset };
    }

    it('yields nothing for an empty string', () => {
      check('', []);
      check('   ', []);
    });

    it('yields nothing for a text-only string', () => {
      check('hello', []);
    });

    it('yields emoji matches', () => {
      check('😀', [match('😀', 0)]);
      check('😀😀😀', [match('😀', 0), match('😀', 2), match('😀', 4)]);
    });

    it('yields emojis inside mixed text', () => {
      check('a😀b👋🏻c', [match('😀', 1), match('👋🏻', 4)]);
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(test.input, test.isEmoji ? [match(test.input, 0)] : []);
        });
      }
    });
  });

  describe('Emoji.getSegments()', () => {
    function check(input: string, expected: Array<Emoji.Segment>) {
      assert.deepEqual(Array.from(Emoji.getSegments(input)), expected);
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

    it('doesnt call Emoji.getMatches() for empty input', () => {
      const spy = sandbox.spy(Emoji, 'getMatches');
      assert.deepEqual(Array.from(Emoji.getSegments('')), [text('', 0)]);
      assert.equal(spy.called, false);

      assert.deepEqual(Array.from(Emoji.getSegments('  ')), [text('  ', 0)]);
      assert.equal(spy.called, false);
    });

    it('only calls Emoji.getMatches().next() while requesting items', () => {
      const getMatchesSpy = spyGetMatches();
      const iterator = Emoji.getSegments('a😀b😀c😀d😀e');

      assert.equal(getMatchesSpy.getNextCallCount(), 0);

      function next(value: string, count: number) {
        assert.equal(iterator.next().value?.value, value);
        assert.equal(getMatchesSpy.getNextCallCount(), count);
      }

      // Note: Only calls getMatches().next() when searching for the next emoji
      next('a', 1);
      next('😀', 1);
      next('b', 2);
      next('😀', 2);
      next('c', 3);
      next('😀', 3);
    });

    it('yields an empty string', () => {
      check('', [text('', 0)]);
    });

    it('yields a whitespace-only string', () => {
      check('  ', [text('  ', 0)]);
    });

    it('yields a single text segment', () => {
      check('abc', [text('abc', 0)]);
    });

    it('yields a single emoji segment', () => {
      check('😀', [emoji('😀', 0)]);
    });

    it('yields multiple emoji segments', () => {
      check('😀😀😀', [emoji('😀', 0), emoji('😀', 2), emoji('😀', 4)]);
    });

    it('yields leading text before emoji', () => {
      check('abc😀', [text('abc', 0), emoji('😀', 3)]);
    });

    it('yields trailing text after emoji', () => {
      check('😀abc', [emoji('😀', 0), text('abc', 2)]);
      check('abc😀😀😀def', [
        text('abc', 0),
        emoji('😀', 3),
        emoji('😀', 5),
        emoji('😀', 7),
        text('def', 9),
      ]);
    });

    it('yields text in between emoji', () => {
      check('😀abc😀', [emoji('😀', 0), text('abc', 2), emoji('😀', 5)]);
    });
  });

  describe('Emoji.isLoneEmoji()', () => {
    function check(input: string, expected: boolean) {
      assert.equal(Emoji.isLoneEmoji(input), expected);
    }

    it('returns true for a single emoji', () => {
      check('😀', true);
      check('👋🏻', true);
    });

    it('returns false for empty input', () => {
      check('', false);
      check('   ', false);
    });

    it('returns false for text-only', () => {
      check('hello', false);
    });

    it('returns false for multiple emoji', () => {
      check('😀😀', false);
    });

    it('returns false with mixed text and emoji', () => {
      check('😀 a', false);
    });

    describe('EMOJI_EDGE_CASES', () => {
      for (const test of EMOJI_EDGE_CASES) {
        it(test.label, () => {
          check(test.input, test.isEmoji);
        });
      }
    });
  });

  describe('Emoji.getJumboEmojiCount()', () => {
    function check(input: string, expected: Emoji.JumboEmojiCount) {
      assert.equal(Emoji.getJumboEmojiCount(input), expected);
    }

    const MAX = Emoji.MAX_JUMBO_EMOJI_COUNT;

    it('returns null for empty input', () => {
      check('', null);
    });

    it('returns null for text-only input', () => {
      check('hello', null);
    });

    it('returns count of single emoji', () => {
      check('😀', 1);
    });

    it('returns count of multiple emojis', () => {
      check('😀😀😀', 3);
    });

    it('returns count of max emojis', () => {
      check('😀😀😀😀😀', MAX);
    });

    it('returns null over max emojis', () => {
      check('😀'.repeat(MAX + 1), null);
    });

    it('returns null for mixed text and emoji', () => {
      check('😀a', null);
      check('a😀', null);
    });
  });

  describe('_toEmojiCompletionDisplay', () => {
    function check(input: string, expected: string) {
      assert.equal(_toEmojiCompletionLabel(input as Emoji.ShortName), expected);
    }

    it('normalizes misc chars', () => {
      check('foo bar', 'foo_bar');
      check('foo,bar', 'foo_bar');
      check('foo_bar', 'foo_bar');
      check('foo-bar', 'foo_bar');
    });

    it('normalizes multiple misc chars', () => {
      check('foo, _-bar', 'foo_bar');
    });

    it('leaves diacritics', () => {
      check('ñ', 'ñ');
    });

    it('lowercases', () => {
      check('N', 'n');
      check('Ñ', 'ñ');
    });

    it('leaves :-1: alone', () => {
      check('-1', '-1');
    });
  });

  describe('_normalizeShortNameCompletionQuery', () => {
    function check(input: string, expected: string) {
      assert.equal(_toEmojiCompletionQuery(input as Emoji.ShortName), expected);
    }

    it('normalizes misc chars', () => {
      check('foo bar', 'foo bar');
      check('foo,bar', 'foo bar');
      check('foo_bar', 'foo bar');
      check('foo-bar', 'foo bar');
    });

    it('normalizes multiple misc chars', () => {
      check('foo, _-bar', 'foo bar');
    });

    it('replaces diacritics', () => {
      check('ñ', 'n');
    });

    it('lowercases', () => {
      check('N', 'n');
      check('Ñ', 'n');
    });

    it('leaves :-1: alone', () => {
      check('-1', '-1');
    });
  });

  describe('search', () => {
    function setup() {
      Emoji.setupLocale([
        { emoji: '😀', rank: 1, tags: ['not-a-default-tag'] },
      ]);
    }

    function check(input: string, expected: Array<string>) {
      assert.deepEqual(
        Emoji.search(input).map(emoji => {
          return Emoji.getCompletionLabel(emoji);
        }),
        expected
      );
    }

    it('returns nothing for empty string', () => {
      check('', []);
      check(' ', []);
      check('   ', []);
    });

    it('falls back to default english short names when no locale is setup', () => {
      check('grinning', ['grinning', 'star_struck', 'zany_face']);
    });

    it('searches emoticons', () => {
      check(':D', ['grinning', 'smile']);
    });

    it('matches localized short names', () => {
      setup();
      check('not a default tag', ['not_a_default_tag']);
    });

    it('falls back to default english short names locale doesnt contain emoji', () => {
      setup();
      check('wave', ['wave']);
    });

    it('searches english short names even when locale contains emoji', () => {
      setup();
      check('grinning', ['not_a_default_tag', 'star_struck', 'zany_face']);
    });

    it('searches emoticons when a locale is setup', () => {
      setup();
      check(':D', ['not_a_default_tag']);
    });
  });
});
