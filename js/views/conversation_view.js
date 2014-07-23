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
      if (!this.$input.val().length) { return false; }
      this.model.sendMessage(this.$input.val());
      this.$input.val("");
      e.preventDefault();
    },

    render: function() {
      this.view.render();
      return this;
    }
  });
})();
