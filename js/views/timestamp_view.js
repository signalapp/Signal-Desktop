/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.TimestampView = Whisper.View.extend({
        initialize: function() {
            extension.windows.onClosed(this.clearTimeout.bind(this));
        },
        update: function() {
            this.clearTimeout();
            var millis_now = Date.now();
            var millis = this.$el.data('timestamp');
            if (millis >= millis_now) {
                millis = millis_now;
            }
            // defined in subclass!
            var result = this.getRelativeTimeSpanString(millis);
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
            } else { // more than a week ago
                // Day of week + time
                delay = 7 * 24 * 60 * 60 * 1000 - millis_since;
            }

            if (delay) {
                if (delay < 0) { delay = 0; }
                this.timeout = setTimeout(this.update.bind(this), delay);
            }
        },
        clearTimeout: function() {
            clearTimeout(this.timeout);
        }
    });

    Whisper.BriefTimestampView = Whisper.TimestampView.extend({
        getRelativeTimeSpanString: function(timestamp_) {
            // Convert to moment timestamp if it isn't already
            var timestamp = moment(timestamp_),
                timediff = moment.duration(moment() - timestamp);

            // Do some wrapping to match conversation view, display >= 30 minutes (seconds)
            // as a full hour (minute) if the number of hours (minutes) isn't zero
            if (timediff.hours >= 1 && timediff.minutes() >= 30) {
                timediff.add(1, 'hours');
            } else if (timediff.minutes() >= 1 && timediff.seconds() >= 30) {
                timediff.add(1, 'minutes');
            }

            if (timediff.years() > 0) {
                return timestamp.format('MMM D, YYYY');
            } else if (timediff.months() > 0 || timediff.days() > 6) {
                return timestamp.format('MMM D');
            } else if (timediff.days() > 0) {
                return timestamp.format('ddd');
            } else if (timediff.hours() > 1) {
                 return timediff.hours() + ' hours';
            } else if (timediff.hours() === 1 || timediff.minutes() >= 45) {
                // to match conversation view, display >= 45 minutes as 1 hour
                return '1 hour';
            } else if (timediff.minutes() > 1) {
                return timediff.minutes() + ' min';
            } else if (timediff.minutes() === 1 || timediff.seconds() >= 45) {
                // same as hours/minutes, 0:00:45 -> 1 min
                return '1 min';
            } else {
                return 'now';
            }
        },
    });


    Whisper.ExtendedTimestampView = Whisper.TimestampView.extend({
        getRelativeTimeSpanString: function(timestamp_) {
            var timestamp = moment(timestamp_),
                now = moment(),
                lastWeek = moment().subtract(7, 'days'),
                lastYear = moment().subtract(1, 'years');
            if (timestamp > now.startOf('day')) {
                // t units ago
                return timestamp.fromNow();
            } else if (timestamp > lastWeek) {
                // Fri 1:30 PM or Fri 13:30
                return timestamp.format('ddd ') + timestamp.format('LT');
            } else if (timestamp > lastYear) {
                // Oct 31 1:30 PM or Oct 31
                return timestamp.format('MMM D ') + timestamp.format('LT');
            } else {
                // Oct 31, 2012 1:30 PM
                return timestamp.format('MMM D, YYYY ') + timestamp.format('LT');
            }
        },
    });
})();
