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

    verifyNumber: function() {
      try {
        var val = this.$el.val();
        if (val[0] === '+') {
          // assume that the country code is specified
          var number = libphonenumber.util.verifyNumber(val);
        } else {
          // assume that the country code should match our own
          var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
          var myRegionCode = libphonenumber.util.getRegionCodeForNumber(me);
          var number = libphonenumber.util.verifyNumber(val, myRegionCode);
        }
        this.removeError();
        return number;
      } catch(ex) {
        this.$el.addClass('error');
        console.log(ex);
      }
    }
  });

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.template = $('#new-message-form').html();
      Mustache.parse(this.template);
      this.render();
      this.input = new MessageRecipientInputView({el: this.$el.find('input.number')});
      this.fileInput = new Whisper.FileInputView({el: this.$el.find('.attachments')});
    },

    events: {
      'submit .send': 'send',
      'close': 'remove'
    },

    send: function(e) {
      e.preventDefault();
      var number = this.input.verifyNumber();
      if (number) {
        var thread = Whisper.Threads.findOrCreateForRecipient(number);
        var message_input = this.$el.find('input.send-message');
        var message = message_input.val();
        if (message.length > 0 || this.fileInput.hasFiles()) {
          this.fileInput.getFiles().then(function(attachments) {
            thread.sendMessage(message, attachments);
          });
          message_input.val("");
        }
        this.remove();
        thread.trigger('render');
      }
    },

    render: function() {
      this.$el.html(Mustache.render(this.template));
      Whisper.Layout.setContent(this.$el.show());
      return this;
    }
  });

})();
