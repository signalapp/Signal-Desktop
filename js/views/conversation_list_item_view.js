var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationListItemView = Backbone.View.extend({
    tagName: 'div',
    className: 'contact',

    events: {
      'click': 'open',
    },
    initialize: function() {
      this.template = $('#contact').html();
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update

      this.$el.addClass('closed');
    },

    open: function(e) {
      $('.conversation').trigger('close'); // detach any existing conversation views
      if (!this.view) {
        this.view = new Whisper.ConversationView({ model: this.model });
      } else {
        this.view.delegateEvents();
      }
      this.view.render();
    },

    render: function() {
      this.$el.html(
        Mustache.render(this.template, {
          contact_name: this.model.get('name'),
          last_message: this.model.get('lastMessage'),
          last_message_timestamp: this.formatTimestamp()
        })
      );

      return this;
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
