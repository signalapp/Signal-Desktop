/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';
    window.emoji_util = window.emoji_util || {};

    // EmojiConverter overrides
    EmojiConvertor.prototype.init_env = function() {
        if (this.inits.env) {
            return;
        }
        this.inits.env = 1;
        this.include_title = true;
        this.img_sets.apple.path = '/images/emoji/apple/';
        this.replace_mode = 'img';
    };
    EmojiConvertor.prototype.replace_unified = function(str) {
        var self = this;
        self.init_unified();
        return str.replace(self.rx_unified, function(m, p1, p2) {
            var val = self.map.unified[p1];
            if (!val) { return m; }
            var idx = null;
            if (p2 == '\uD83C\uDFFB') { idx = '1f3fb'; }
            if (p2 == '\uD83C\uDFFC') { idx = '1f3fc'; }
            if (p2 == '\uD83C\uDFFD') { idx = '1f3fd'; }
            if (p2 == '\uD83C\uDFFE') { idx = '1f3fe'; }
            if (p2 == '\uD83C\uDFFF') { idx = '1f3ff'; }
            if (idx) {
                return self.replacement(val, null, null, {
                    idx : idx,
                    actual  : p2,
                    wrapper : ':'
                });
            }
            // wrap names in :'s
            return self.replacement(val, ':' + self.data[val][3][0] + ':');
        });
    };
    window.emoji = new EmojiConvertor();
    emoji.init_colons();

    window.emoji_util.parse = function($el) {
        if (!$el || !$el.length) {
            return;
        }
        $el.html(emoji.replace_unified($el.html()));
    };

})();
