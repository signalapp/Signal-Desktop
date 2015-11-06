/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.MessageTimestampView = Whisper.View.extend({
        update: function() {
            clearTimeout(this.timeout);
            var millis_now = Date.now();
            var millis = this.$el.data('timestamp');
            if (millis >= millis_now) {
                millis = millis_now;
            }
            var lastWeek = moment(millis_now).subtract(7, 'days');
            var time = moment(millis);
            var result = '';
            if (time > moment(millis_now).startOf('day')) {
                // t units ago
                result = time.fromNow();
            } else if (time > lastWeek) {
                // Fri 1:30 PM or Fri 13:30
                result = time.format('ddd ') + time.format('LT');
            } else {
                // Oct 31 1:30 PM or Oct 31
                result = time.format('MMM D ') + time.format('LT');
            }
            this.$el.text(result);

            var delay;
            var millis_since = millis_now - millis;
            if (millis_since <= moment.relativeTimeThreshold('s') * 1000) {
                // a few seconds ago
                delay = 45 * 1000 - millis_since;
            } else if (millis_since <= moment.relativeTimeThreshold('m') * 1000 * 60) {
                // N minutes ago
                delay = 60 * 1000;
            } else if (millis_since <= moment.relativeTimeThreshold('h') * 1000 * 60 * 60) {
                // N hours ago
                delay = 60 * 60 * 1000;
            } else if (time > lastWeek) {
                // Day of week + time
                delay = 7 * 24 * 60 * 60 * 1000 - millis_since;
            }

            if (delay) {
                if (delay < 0) { delay = 0; }
                this.timeout = setTimeout(this.update.bind(this), delay);
            }
        }
    });
})();
