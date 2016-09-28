
/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};
    Whisper.ExpiringMessages = new (Whisper.MessageCollection.extend({
        initialize: function() {
            this.on('expired', this.remove);
            this.fetchExpiring();
        }
    }))();

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
      },
      getAbbreviated: function(seconds) {
        if (!seconds) {
          seconds = 0;
        }
        var o = this.findWhere({seconds: seconds});
        if (o) { return o.getAbbreviated(); }
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
