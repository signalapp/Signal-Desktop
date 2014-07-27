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
      $('#main').trigger('close'); // detach any existing conversation views
      if (!this.view) {
        this.view = new Whisper.ConversationView({
          el: $('#main'),
          model: this.model
        });
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
          last_message_timestamp: this.model.get('timestamp')
        })
      );

      return this;
    },

  });
})();
