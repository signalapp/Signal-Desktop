/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';

    window.emoji_util = window.emoji_util || {};

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

})();
