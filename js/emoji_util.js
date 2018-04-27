/*
 * vim: ts=4:sw=4:expandtab
 */

(function() {
  'use strict';
  window.emoji_util = window.emoji_util || {};

  // EmojiConverter overrides
  EmojiConvertor.prototype.getCountOfAllMatches = function(str, regex) {
    var match = regex.exec(str);
    var count = 0;

    if (!regex.global) {
      return match ? 1 : 0;
    }

    while (match) {
      count += 1;
      match = regex.exec(str);
    }

    return count;
  };

  EmojiConvertor.prototype.hasNormalCharacters = function(str) {
    var self = this;
    var noEmoji = str.replace(self.rx_unified, '').trim();
    return noEmoji.length > 0;
  };

  EmojiConvertor.prototype.getSizeClass = function(str) {
    var self = this;

    if (self.hasNormalCharacters(str)) {
      return '';
    }

    var emojiCount = self.getCountOfAllMatches(str, self.rx_unified);
    if (emojiCount > 8) {
      return '';
    } else if (emojiCount > 6) {
      return 'small';
    } else if (emojiCount > 4) {
      return 'medium';
    } else if (emojiCount > 2) {
      return 'large';
    } else {
      return 'jumbo';
    }
  };

  var imgClass = /(<img [^>]+ class="emoji)(")/g;
  EmojiConvertor.prototype.addClass = function(text, sizeClass) {
    if (!sizeClass) {
      return text;
    }

    return text.replace(imgClass, function(match, before, after) {
      return before + ' ' + sizeClass + after;
    });
  };

  var imgTitle = /(<img [^>]+ class="emoji[^>]+ title=")([^:">]+)(")/g;
  EmojiConvertor.prototype.ensureTitlesHaveColons = function(text) {
    return text.replace(imgTitle, function(match, before, title, after) {
      return before + ':' + title + ':' + after;
    });
  };

  EmojiConvertor.prototype.signalReplace = function(str) {
    var sizeClass = this.getSizeClass(str);

    var text = this.replace_unified(str);
    text = this.addClass(text, sizeClass);

    return this.ensureTitlesHaveColons(text);
  };

  window.emoji = new EmojiConvertor();
  emoji.init_colons();
  emoji.img_sets.apple.path =
    'node_modules/emoji-datasource-apple/img/apple/64/';
  emoji.include_title = true;
  emoji.replace_mode = 'img';
  emoji.supports_css = false; // needed to avoid spans with background-image

  window.emoji_util.parse = function($el) {
    if (!$el || !$el.length) {
      return;
    }

    $el.html(emoji.signalReplace($el.html()));
  };
})();
