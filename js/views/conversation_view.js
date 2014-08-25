var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.stopListening); // auto update
      this.template = $('#conversation').html();
      Mustache.parse(this.template);
      this.$el.html(Mustache.render(this.template));

      this.view = new Whisper.MessageListView({collection: this.model.messages()});
      this.$el.find('.discussion-container').append(this.view.el);
    },
    events: {
      'submit .send': 'sendMessage',
      'close': 'remove'
    },

    sendMessage: function(e) {
      e.preventDefault();
      var input = this.$el.find('.send input');
      if (input.val().length > 0) {
        this.model.sendMessage(input.val());
        input.val("");
      }
    },

    render: function() {
      this.$el.show().insertAfter($('#gutter'));
      resizer();
      return this;
    }
  });
})();
