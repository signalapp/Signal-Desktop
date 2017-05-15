'use strict';

describe('EmojiUtil', function() {
    describe('getCountOfAllMatches', function() {
        it('returns zero for string with no matches', function() {
            var r = /s/g;
            var str = 'no match';
            var actual = emoji.getCountOfAllMatches(str, r);
            assert.equal(actual, 0);
        });
        it('returns 1 for one match', function() {
            var r = /s/g;
            var str = 'just one match';
            var actual = emoji.getCountOfAllMatches(str, r);
            assert.equal(actual, 1);
        });
        it('returns 2 for two matches', function() {
            var r = /s/g;
            var str = 's + s';
            var actual = emoji.getCountOfAllMatches(str, r);
            assert.equal(actual, 2);
        });
        it('returns zero for no match with non-global regular expression', function() {
            var r = /s/g;
            var str = 'no match';
            var actual = emoji.getCountOfAllMatches(str, r);
            assert.equal(actual, 0);
        });
        it('returns 1 for match with non-global regular expression', function() {
            var r = /s/;
            var str = 's + s';
            var actual = emoji.getCountOfAllMatches(str, r);
            assert.equal(actual, 1);
        });
    });

    describe('hasNormalCharacters', function() {
        it('returns true for all normal text', function() {
            var str = 'normal';
            var actual = emoji.hasNormalCharacters(str);
            assert.equal(actual, true);
        });
        it('returns false for all emoji text', function() {
            var str = '🔥🔥🔥🔥';
            var actual = emoji.hasNormalCharacters(str);
            assert.equal(actual, false);
        });
        it('returns false for emojis mixed with spaces', function() {
            var str = '🔥 🔥 🔥 🔥';
            var actual = emoji.hasNormalCharacters(str);
            assert.equal(actual, false);
        });
        it('returns true for emojis and text', function() {
            var str = '🔥 normal 🔥 🔥 🔥';
            var actual = emoji.hasNormalCharacters(str);
            assert.equal(actual, true);
        });
    });

    describe('getSizeClass', function() {
        it('returns nothing for non-emoji text', function() {
            assert.equal(emoji.getSizeClass('normal text'), '');
        });
        it('returns nothing for emojis mixed with text', function() {
            assert.equal(emoji.getSizeClass('🔥 normal 🔥'), '');
        });
        it('returns nothing for more than 8 emojis', function() {
            assert.equal(emoji.getSizeClass('🔥🔥 🔥🔥 🔥🔥 🔥🔥 🔥'), '');
        });
        it('returns "small" for 7-8 emojis', function() {
            assert.equal(emoji.getSizeClass('🔥🔥 🔥🔥 🔥🔥 🔥🔥'), 'small');
            assert.equal(emoji.getSizeClass('🔥🔥 🔥🔥 🔥🔥 🔥'), 'small');
        });
        it('returns "medium" for 5-6 emojis', function() {
            assert.equal(emoji.getSizeClass('🔥🔥 🔥🔥 🔥🔥'), 'medium');
            assert.equal(emoji.getSizeClass('🔥🔥 🔥🔥 🔥'), 'medium');
        });
        it('returns "large" for 3-4 emojis', function() {
            assert.equal(emoji.getSizeClass('🔥🔥 🔥🔥'), 'large');
            assert.equal(emoji.getSizeClass('🔥🔥 🔥'), 'large');
        });
        it('returns "jumbo" for 1-2 emojis', function() {
            assert.equal(emoji.getSizeClass('🔥🔥'), 'jumbo');
            assert.equal(emoji.getSizeClass('🔥'), 'jumbo');
        });
    });

    describe('replacement', function() {
        it('returns an <img> tag', function() {
            var actual = emoji.replacement('1f525');
            assert.equal(actual, '<img src="images/emoji/apple/1f525.png" class="emoji" title="fire"/>');
        });
        it('returns an <img> tag with provided sizeClass', function() {
            var actual = emoji.replacement('1f525', 'large');
            assert.equal(actual, '<img src="images/emoji/apple/1f525.png" class="emoji large" title="fire"/>');
        });
    });

    describe('replace_unified', function() {
        it('returns images for every emoji', function() {
            var actual = emoji.replace_unified('🏠 🔥');
            var expected = '<img src="images/emoji/apple/1f3e0.png" class="emoji jumbo" title=":house:"/>'
                + ' <img src="images/emoji/apple/1f525.png" class="emoji jumbo" title=":fire:"/>';

            assert.equal(expected, actual);
        });
        it('properly hyphenates a variation', function() {
            var actual = emoji.replace_unified('💪🏿'); // muscle with dark skin tone modifier
            var expected = '<img src="images/emoji/apple/1f4aa-1f3ff.png" class="emoji jumbo" title="muscle"/>';

            assert.equal(expected, actual);
        });
    });
});
