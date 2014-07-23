var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.ConversationView = Backbone.View.extend({
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.remove); // auto update
      var v = new Whisper.MessageListView({collection: this.model.messages()});
      v.render();
    },
    events: {
      'submit #new-message': 'sendMessage',
    },

    sendMessage: function(e) {
      if (!this.$input.val().length) { return false; }
      this.model.sendMessage(this.$input.val());
      this.$input.val("");
      e.preventDefault();
    },
  });
})();
