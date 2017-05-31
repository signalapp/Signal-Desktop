
/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    function destroyExpiredMessages() {
        // Load messages that have expired and destroy them
        var expired = new Whisper.MessageCollection();
        expired.on('add', function(message) {
            console.log('message', message.get('sent_at'), 'expired');
            message.destroy();
            message.getConversation().trigger('expired', message);
        });
        expired.on('reset', checkExpiringMessages);

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
            if (wait < 0) { wait = 0; }

            clearTimeout(timeout);
            timeout = setTimeout(destroyExpiredMessages, wait);
        });
        expiring.fetchNextExpiring();
    }

    Whisper.ExpiringMessagesListener = {
        init: function(events) {
            checkExpiringMessages();
            events.on('timetravel', checkExpiringMessages);
        },
        update: checkExpiringMessages
    };

    var TimerOption = Backbone.Model.extend({
      getName: function() {
        return i18n([
          'timerOption', this.get('time'), this.get('unit'),
        ].join('_')) || moment.duration(this.get('time'), this.get('unit')).humanize();
      },
      getAbbreviated: function() {
        return i18n([
          'timerOption', this.get('time'), this.get('unit'), 'abbreviated'
        ].join('_'));
      }
    });
    Whisper.ExpirationTimerOptions = new (Backbone.Collection.extend({
      model: TimerOption,
      getName: function(seconds) {
        if (!seconds) {
          seconds = 0;
        }
        var o = this.findWhere({seconds: seconds});
        if (o) { return o.getName(); }
        else {
          return [seconds, 'seconds'].join(' ');
        }
      },
      getAbbreviated: function(seconds) {
        if (!seconds) {
          seconds = 0;
        }
        var o = this.findWhere({seconds: seconds});
        if (o) { return o.getAbbreviated(); }
        else {
          return [seconds, 's'].join('');
        }
      }
    }))([
        [ 0,  'seconds'  ],
        [ 5,  'seconds'  ],
        [ 10, 'seconds'  ],
        [ 30, 'seconds'  ],
        [ 1,  'minute'   ],
        [ 5,  'minutes'  ],
        [ 30, 'minutes'  ],
        [ 1,  'hour'     ],
        [ 6,  'hours'    ],
        [ 12, 'hours'    ],
        [ 1,  'day'      ],
        [ 1,  'week'     ],
    ].map(function(o) {
      var duration = moment.duration(o[0], o[1]); // 5, 'seconds'
      return {
        time: o[0],
        unit: o[1],
        seconds: duration.asSeconds()
      };
    }));

})();
