/* global moment: false */
/* global Whisper: false */
/* global extension: false */
/* global i18n: false */
/* global _: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  function extendedRelativeTime(number, string) {
    return moment.duration(-1 * number, string).humanize(string !== 's');
  }

  const extendedFormats = {
    y: 'lll',
    M: `${i18n('timestampFormat_M') || 'MMM D'} LT`,
    d: 'ddd LT',
  };

  function shortRelativeTime(number, string) {
    return moment.duration(number, string).humanize();
  }
  const shortFormats = {
    y: 'll',
    M: i18n('timestampFormat_M') || 'MMM D',
    d: 'ddd',
  };

  function getRelativeTimeSpanString(rawTimestamp, options = {}) {
    _.defaults(options, { extended: false });

    const relativeTime = options.extended
      ? extendedRelativeTime
      : shortRelativeTime;
    const formats = options.extended ? extendedFormats : shortFormats;

    // Convert to moment timestamp if it isn't already
    const timestamp = moment(rawTimestamp);
    const now = moment();
    const timediff = moment.duration(now - timestamp);

    if (timediff.years() > 0) {
      return timestamp.format(formats.y);
    } else if (timediff.months() > 0 || timediff.days() > 6) {
      return timestamp.format(formats.M);
    } else if (timediff.days() > 0) {
      return timestamp.format(formats.d);
    } else if (timediff.hours() >= 1) {
      return relativeTime(timediff.hours(), 'h');
    } else if (timediff.minutes() >= 1) {
      // Note that humanize seems to jump to '1 hour' as soon as we cross 45 minutes
      return relativeTime(timediff.minutes(), 'm');
    }

    return relativeTime(timediff.seconds(), 's');
  }

  Whisper.TimestampView = Whisper.View.extend({
    initialize() {
      extension.windows.onClosed(this.clearTimeout.bind(this));
    },
    update() {
      this.clearTimeout();
      const millisNow = Date.now();
      let millis = this.$el.data('timestamp');
      if (millis === '') {
        return;
      }
      if (millis >= millisNow) {
        millis = millisNow;
      }
      const result = this.getRelativeTimeSpanString(millis);
      this.delay = this.getDelay(millis);
      this.$el.text(result);

      const timestamp = moment(millis);
      this.$el.attr('title', timestamp.format('llll'));

      if (this.delay) {
        if (this.delay < 0) {
          this.delay = 1000;
        }
        this.timeout = setTimeout(this.update.bind(this), this.delay);
      }
    },
    clearTimeout() {
      clearTimeout(this.timeout);
    },
    getRelativeTimeSpanString(timestamp) {
      return getRelativeTimeSpanString(timestamp);
    },
    getDelay(rawTimestamp) {
      // Convert to moment timestamp if it isn't already
      const timestamp = moment(rawTimestamp);
      const now = moment();
      const timediff = moment.duration(now - timestamp);

      if (timediff.years() > 0) {
        return null;
      } else if (timediff.months() > 0 || timediff.days() > 6) {
        return null;
      } else if (timediff.days() > 0) {
        return moment(timestamp)
          .add(timediff.days() + 1, 'd')
          .diff(now);
      } else if (timediff.hours() >= 1) {
        return moment(timestamp)
          .add(timediff.hours() + 1, 'h')
          .diff(now);
      } else if (timediff.minutes() >= 1) {
        return moment(timestamp)
          .add(timediff.minutes() + 1, 'm')
          .diff(now);
      }

      return moment(timestamp)
        .add(1, 'm')
        .diff(now);
    },
  });
  Whisper.ExtendedTimestampView = Whisper.TimestampView.extend({
    getRelativeTimeSpanString(timestamp) {
      return getRelativeTimeSpanString(timestamp, { extended: true });
    },
  });
})();
