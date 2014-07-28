var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationView = Backbone.View.extend({
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.stopListening); // auto update

      this.view = new Whisper.MessageListView({collection: this.model.messages()});
    },
    events: {
      'submit #send': 'sendMessage',
      'close': 'undelegateEvents'
    },

    sendMessage: function(e) {
      e.preventDefault();
      var input = this.$el.find('#send input');
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
