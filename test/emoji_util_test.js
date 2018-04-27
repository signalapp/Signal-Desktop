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

  describe('addClass', function() {
    it('returns original string if no emoji images', function() {
      var start = 'no images. but there is some 🔥. <img src="random.jpg" />';

      var expected = start;
      var actual = emoji.addClass(start, 'jumbo');

      assert.equal(expected, actual);
    });

    it('returns original string if no sizeClass provided', function() {
      var start =
        'before <img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji" title="house"/> after';

      var expected = start;
      var actual = emoji.addClass(start);

      assert.equal(expected, actual);
    });

    it('adds provided class to image class', function() {
      var start =
        'before <img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji" title="house"/> after';

      var expected =
        'before <img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji jumbo" title="house"/> after';
      var actual = emoji.addClass(start, 'jumbo');

      assert.equal(expected, actual);
    });
  });

  describe('ensureTitlesHaveColons', function() {
    it('returns original string if no emoji images', function() {
      var start = 'no images. but there is some 🔥. <img src="random.jpg" />';

      var expected = start;
      var actual = emoji.ensureTitlesHaveColons(start);

      assert.equal(expected, actual);
    });

    it('returns original string if image title already has colons', function() {
      var start =
        'before <img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji" title=":house:"/> after';

      var expected = start;
      var actual = emoji.ensureTitlesHaveColons(start);

      assert.equal(expected, actual);
    });

    it('does not change title for non-emoji image', function() {
      var start =
        'before <img src="random.png" title="my random title"/> after';

      var expected = start;
      var actual = emoji.ensureTitlesHaveColons(start);

      assert.equal(expected, actual);
    });

    it('adds colons to emoji image title', function() {
      var start =
        'before <img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji" title="house"/> after';

      var expected =
        'before <img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji" title=":house:"/> after';
      var actual = emoji.ensureTitlesHaveColons(start);

      assert.equal(expected, actual);
    });
  });

  describe('signalReplace', function() {
    it('returns images for every emoji', function() {
      var actual = emoji.signalReplace('🏠 🔥');
      var expected =
        '<img src="node_modules/emoji-datasource-apple/img/apple/64/1f3e0.png" class="emoji jumbo" data-codepoints="1f3e0"  title=":house:"/>' +
        ' <img src="node_modules/emoji-datasource-apple/img/apple/64/1f525.png" class="emoji jumbo" data-codepoints="1f525"  title=":fire:"/>';

      assert.equal(expected, actual);
    });
    it('properly hyphenates a variation', function() {
      var actual = emoji.signalReplace('💪🏿'); // muscle with dark skin tone modifier
      var expected =
        '<img src="node_modules/emoji-datasource-apple/img/apple/64/1f4aa-1f3ff.png" class="emoji jumbo" data-codepoints="1f4aa-1f3ff"  title=":muscle:"/>';

      assert.equal(expected, actual);
    });
  });
});
