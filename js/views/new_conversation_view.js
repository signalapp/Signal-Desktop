/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
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
      this.$el.html($(Mustache.render(this.template)));
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
        var convo = this.collection.findOrCreateForRecipient(number);
        var message_input = this.$el.find('input.send-message');
        var message = message_input.val();
        if (message.length > 0 || this.fileInput.hasFiles()) {
          this.fileInput.getFiles().then(function(attachments) {
            convo.sendMessage(message, attachments);
          });
          message_input.val("");
        }
        this.remove();
        convo.trigger('render');
      }
    }
  });

})();
