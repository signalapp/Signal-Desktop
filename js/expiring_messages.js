/* global _: false */
/* global Backbone: false */
/* global i18n: false */
/* global moment: false */
/* global Whisper: false */
/* global wrapDeferred: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  function destroyExpiredMessages() {
    // Load messages that have expired and destroy them
    const expired = new Whisper.MessageCollection();
    expired.on('add', async message => {
      console.log('Message expired', {
        sentAt: message.get('sent_at'),
      });
      const conversation = message.getConversation();
      if (conversation) {
        conversation.trigger('expired', message);
      }

      // We delete after the trigger to allow the conversation time to process
      //   the expiration before the message is removed from the database.
      await wrapDeferred(message.destroy());
      if (conversation) {
        conversation.updateLastMessage();
      }
    });
    expired.on('reset', throttledCheckExpiringMessages);

    expired.fetchExpired();
  }

  let timeout;
  function checkExpiringMessages() {
    // Look up the next expiring message and set a timer to destroy it
    const expiring = new Whisper.MessageCollection();
    expiring.once('add', next => {
      const expiresAt = next.get('expires_at');
      console.log('next message expires', new Date(expiresAt).toISOString());

      let wait = expiresAt - Date.now();

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
  const throttledCheckExpiringMessages = _.throttle(
    checkExpiringMessages,
    1000
  );

  Whisper.ExpiringMessagesListener = {
    init(events) {
      checkExpiringMessages();
      events.on('timetravel', throttledCheckExpiringMessages);
    },
    update: throttledCheckExpiringMessages,
  };

  const TimerOption = Backbone.Model.extend({
    getName() {
      return (
        i18n(['timerOption', this.get('time'), this.get('unit')].join('_')) ||
        moment.duration(this.get('time'), this.get('unit')).humanize()
      );
    },
    getAbbreviated() {
      return i18n(
        ['timerOption', this.get('time'), this.get('unit'), 'abbreviated'].join(
          '_'
        )
      );
    },
  });
  Whisper.ExpirationTimerOptions = new (Backbone.Collection.extend({
    model: TimerOption,
    getName(seconds = 0) {
      const o = this.findWhere({ seconds });
      if (o) {
        return o.getName();
      }
      return [seconds, 'seconds'].join(' ');
    },
    getAbbreviated(seconds = 0) {
      const o = this.findWhere({ seconds });
      if (o) {
        return o.getAbbreviated();
      }
      return [seconds, 's'].join('');
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
    ].map(o => {
      const duration = moment.duration(o[0], o[1]); // 5, 'seconds'
      return {
        time: o[0],
        unit: o[1],
        seconds: duration.asSeconds(),
      };
    })
  );
})();
