/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';
    window.emoji_util = window.emoji_util || {};

    // The default version of this function has issues initing from the
    // background page. Since we only support one environment, we can
    // preconfigure it here.
    EmojiConvertor.prototype.init_env = function() {
        if (this.inits.env) {
            return;
        }
		this.inits.env = 1;
        this.include_title = true;
        this.img_sets.apple.path = 'images/emoji/apple/';

        this.img_path = 'images/emoji/unicode/';
        this.replace_mode = 'img';
        this.supports_css = true;
    };
    window.emoji = new EmojiConvertor();
    emoji.init_colons();

    // Map from single unicode emoji strings to "colon" strings
    var unicode_emoji_map;
    var initialized = false;

    function initialize() {
      if (initialized) {
        return;
      }
      initialized = true;
      unicode_emoji_map = {};
      $.each(emoji.data, function(_, data) {
        if (data[0] && data[0][0] && data[3] && data[3].length > 0) {
          unicode_emoji_map[data[0][0]] = data[3][0];
        }
      });
    }

    window.emoji_util.get_colon_from_unicode = function(emoji_string) {
      initialize();
      return unicode_emoji_map[emoji_string];
    };

    window.emoji_util.parse = function($el) {
        $el.html(emoji.replace_unified($el.text()));
    };

})();
