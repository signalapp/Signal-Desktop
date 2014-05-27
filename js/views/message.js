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
      this.$el.
        append($('<div class="bubble">').
          append(
            $('<span class="message-text">'),
            $('<span class="message-attachment">'),
            $('<span class="metadata">')
          )
        );
      this.$el.addClass(this.model.get('type'));
      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update
    },

    render: function() {
      this.$el.find('.message-text').text(this.model.get('body'));
      var attachments = this.model.get('attachments');
      if (attachments) {
        for (var i = 0; i < attachments.length; i++)
          this.$el.find('.message-attachment').append('<img src="' + attachments[i] + '" />');
      }

      this.$el.find('.metadata').text(this.formatTimestamp());
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
