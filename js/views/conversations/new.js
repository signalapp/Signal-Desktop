(function () {
  'use strict';

  Whisper.ConversationComposeView = Backbone.View.extend({
    events : {
      'click #send_link'      : 'show_send',
      'click #send'           : 'focus_send',
      'click #compose-cancel' : 'hide_send',
      'submit #send'          : 'submit_send'
    },
    show_send: function(e) {
      $('#send').fadeIn().find('input[type=text]').focus();
    },
    focus_send: function(e) {
      $('#send input[type=text]').focus();
    },
    hide_send: function(e) {
      $('#send').hide();
      e.preventDefault();
    },
    submit_send: function(e) {
      e.preventDefault();
      var numbers = [];
      var splitString = $("#send_numbers").val().split(",");
      for (var i = 0; i < splitString.length; i++) {
        try {
          numbers.push(textsecure.utils.verifyNumber(splitString[i], textsecure.storage.getUnencrypted("regionCode")));
        } catch (numberError) {
          if (!numberError.countryCodeValid) {
            Whisper.notify('Invalid country code');
          }
          if (!numberError.numberValid) {
            Whisper.notify('Invalid number');
          }
          $('#send input[type=text]').focus();
          return;
        }
      }
      $("#send_numbers").val('');
      $('#send').hide();
      Whisper.Threads.findOrCreateForRecipient(numbers).trigger('select');
    }
  });
})();

