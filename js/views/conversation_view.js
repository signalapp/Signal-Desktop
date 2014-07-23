var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationView = Backbone.View.extend({
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.stopListening); // auto update

      this.view = new Whisper.MessageListView({collection: this.model.messages()});
    },
    events: {
      'submit #new-message': 'sendMessage',
      'close': 'undelegateEvents'
    },

    sendMessage: function(e) {
      e.preventDefault();
      var input = $('#new-message-text');
      if (input.val().length > 0) {
        this.model.sendMessage(input.val());
        input.val("");
      }
    },

    render: function() {
      this.view.render();
      return this;
    }
  });
})();
