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
        this.img_sets.apple.path = 'images/emoji/apple/';
        this.replace_mode = 'img';
    };

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
        }
        else if (emojiCount > 6) {
            return 'small';
        }
        else if (emojiCount > 4) {
            return 'medium';
        }
        else if (emojiCount > 2) {
            return 'large';
        }
        else {
            return 'jumbo';
        }
    };

    // A stripped-down version of the original: https://github.com/WhisperSystems/Signal-Desktop/blob/aed573562018462fbacd8f2f715e9daeddcde0dd/components/emojijs/lib/emoji.js#L323-L396
    // One primary change - we inject the second parameter as an additional class
    EmojiConvertor.prototype.replacement = function(idx, sizeClass, actual, wrapper, variation) {
        var self = this;
        var img_set = self.img_set;

        var extra = '';
        var variation_idx = 0;
        if (typeof variation === 'object') {
            extra = self.replacement(variation.idx, null, variation.actual, variation.wrapper);
            variation_idx = idx + '-' + variation.idx;
        }

        var img = self.data[idx][7] || self.img_sets[img_set].path + idx + '.png' + self.img_suffix;
        var title = self.include_title ? ' title="' + (actual || self.data[idx][3][0]) + '"' : '';

        if (variation_idx && self.variations_data[variation_idx] && self.variations_data[variation_idx][2] && !self.data[idx][7]) {
            if (self.variations_data[variation_idx][2] & self.img_sets[self.img_set].mask) {
                img = self.img_sets[self.img_set].path + variation_idx + '.png';
                extra = '';
            }
        }

        return '<img src="' + img + '" class="emoji' + (sizeClass ?  ' ' + sizeClass : '') + '"' + title + '/>';
    };

    // Modeled after the original: https://github.com/WhisperSystems/Signal-Desktop/blob/aed573562018462fbacd8f2f715e9daeddcde0dd/components/emojijs/lib/emoji.js#L265-L286
    EmojiConvertor.prototype.replace_unified = function(str) {
        var self = this;
        self.init_unified();

        var sizeClass = self.getSizeClass(str);

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
                return self.replacement(val, sizeClass, null, null, {
                    idx : idx,
                    actual  : p2,
                    wrapper : ':'
                });
            }
            // wrap names in :'s
            return self.replacement(val, sizeClass, ':' + self.data[val][3][0] + ':');
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
