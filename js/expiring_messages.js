(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  function destroyExpiredMessages() {
    // Load messages that have expired and destroy them
    var expired = new Whisper.MessageCollection();
    expired.on('add', function(message) {
      console.log('Message expired', {
        sentAt: message.get('sent_at'),
      });
      var conversation = message.getConversation();
      if (conversation) {
        conversation.trigger('expired', message);
      }

      // We delete after the trigger to allow the conversation time to process
      //   the expiration before the message is removed from the database.
      message.destroy();
    });
    expired.on('reset', throttledCheckExpiringMessages);

    expired.fetchExpired();
  }

  var timeout;
  function checkExpiringMessages() {
    // Look up the next expiring message and set a timer to destroy it
    var expiring = new Whisper.MessageCollection();
    expiring.once('add', function(next) {
      var expires_at = next.get('expires_at');
      console.log('next message expires', new Date(expires_at).toISOString());

      var wait = expires_at - Date.now();

      // In the past
      if (wait < 0) {
        wait = 0;
      }

      // Too far in the future, since it's limited to a 32-bit value
      if (wait > 2147483647) {
        wait = 2147483647;
      }

      clearTimeout(timeout);
      timeout = setTimeout(destroyExpiredMessages, wait);
    });
    expiring.fetchNextExpiring();
  }
  var throttledCheckExpiringMessages = _.throttle(checkExpiringMessages, 1000);

  Whisper.ExpiringMessagesListener = {
    init: function(events) {
      checkExpiringMessages();
      events.on('timetravel', throttledCheckExpiringMessages);
    },
    update: throttledCheckExpiringMessages,
  };

  var TimerOption = Backbone.Model.extend({
    getName: function() {
      return (
        i18n(['timerOption', this.get('time'), this.get('unit')].join('_')) ||
        moment.duration(this.get('time'), this.get('unit')).humanize()
      );
    },
    getAbbreviated: function() {
      return i18n(
        ['timerOption', this.get('time'), this.get('unit'), 'abbreviated'].join(
          '_'
        )
      );
    },
  });
  Whisper.ExpirationTimerOptions = new (Backbone.Collection.extend({
    model: TimerOption,
    getName: function(seconds) {
      if (!seconds) {
        seconds = 0;
      }
      var o = this.findWhere({ seconds: seconds });
      if (o) {
        return o.getName();
      } else {
        return [seconds, 'seconds'].join(' ');
      }
    },
    getAbbreviated: function(seconds) {
      if (!seconds) {
        seconds = 0;
      }
      var o = this.findWhere({ seconds: seconds });
      if (o) {
        return o.getAbbreviated();
      } else {
        return [seconds, 's'].join('');
      }
    },
  }))(
    [
      [0, 'seconds'],
      [5, 'seconds'],
      [10, 'seconds'],
      [30, 'seconds'],
      [1, 'minute'],
      [5, 'minutes'],
      [30, 'minutes'],
      [1, 'hour'],
      [6, 'hours'],
      [12, 'hours'],
      [1, 'day'],
      [1, 'week'],
    ].map(function(o) {
      var duration = moment.duration(o[0], o[1]); // 5, 'seconds'
      return {
        time: o[0],
        unit: o[1],
        seconds: duration.asSeconds(),
      };
    })
  );
})();
