var Whisper = Whisper || {};

(function () {
  'use strict';
  var MessageRecipientInputView = Backbone.View.extend({
    events: {
      'change': 'verifyNumber',
      'focus' : 'removeError'
    },

    removeError: function() {
      this.$el.removeClass('error');
    },

    verifyNumber: function(item) {
      try {
        if (libphonenumber.util.verifyNumber(this.$el.val())) {
          this.removeError();
          return;
        }
      } catch(ex) { console.log(ex); }
      this.$el.addClass('error');
    }
  });

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.template = $('#new-message-form').html();
      Mustache.parse(this.template);
      this.render();
      this.input = this.$el.find('input.number');
      new MessageRecipientInputView({el: this.input});
    },

    events: {
      'submit .send': 'send',
      'close': 'remove'
    },

    send: function(e) {
      e.preventDefault();
      var number = this.input.val();
      try {
        if (libphonenumber.util.verifyNumber(number)) {
          var thread = Whisper.Threads.findOrCreateForRecipient(number);
          var message_input = this.$el.find('input.send-message');
          thread.sendMessage(message_input.val());
          this.remove();
          thread.trigger('render');
        }
      } catch(ex) {}
    },

    render: function() {
      this.$el.html(Mustache.render(this.template));
      Whisper.Layout.setContent(this.$el.show());
      return this;
    }
  });

})();
