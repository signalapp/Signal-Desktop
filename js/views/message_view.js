var Whisper = Whisper || {};

(function () {
  'use strict';

  var Destroyer = Backbone.View.extend({
    tagName: 'button',
    className: 'btn btn-square btn-sm',
    initialize: function() {
      this.$el.html('&times;');
      this.listenTo(this.$el, 'click', this.model.destroy);
    }
  });

  Whisper.MessageView = Backbone.View.extend({
    tagName:   "li",
    className: "message",

    initialize: function() {
      this.$el.addClass(this.model.get('type'));
      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update
      this.template = $('#message').html();
      Mustache.parse(this.template);
    },

    render: function() {
      this.$el.html(
        Mustache.render(this.template, {
          body: this.model.get('body'),
          date: this.formatTimestamp(),
          attachments: this.model.get('attachments')
        })
      );

      return this;
    },

    remove: function() {
      this.$el.remove();
    },

    formatTimestamp: function() {
      var timestamp = this.model.get('timestamp');
      var now = new Date().getTime();
      var date = new Date();
      date.setTime(timestamp*1000);
      if (now - timestamp > 60*60*24*7) {
        return date.toLocaleDateString('en-US',{month: 'short', day: 'numeric'});
      }
      if (now - timestamp > 60*60*24) {
        return date.toLocaleDateString('en-US',{weekday: 'short'});
      }
      return date.toTimeString();
    }
  });

})();
