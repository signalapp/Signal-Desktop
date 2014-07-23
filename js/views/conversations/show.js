var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationView = Backbone.View.extend({
    tagName: 'li',
    className: 'conversation',

    events: {
      'click': 'open',
      'submit form': 'sendMessage'
    },
    initialize: function() {
      this.template = $('#contact').html();
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update

      this.$el.addClass('closed');
    },

    sendMessage: function(e) {
      if (!this.$input.val().length) { return false; }
      this.model.sendMessage(this.$input.val());
      this.$input.val("");
      e.preventDefault();
    },

    remove: function() {
      this.$el.remove();
    },

    open: function(e) {
      var v = new Whisper.MessageListView({collection: this.model.messages()});
      v.render();
    },

    render: function() {
      this.$el.html(
        Mustache.render(this.template, {
          name: this.model.get('name')
        })
      );

      return this;
    },

  });
})();
