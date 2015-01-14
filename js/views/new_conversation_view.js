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

  Whisper.NewConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.template = $('#new-message-form').html();
      Mustache.parse(this.template);
      this.$el.html($(Mustache.render(this.template)));
      this.input = new Whisper.PhoneInputView({el: this.$el.find('div.phone-number-input')});
      this.fileInput = new Whisper.FileInputView({el: this.$el.find('.attachments')});
      this.$el.find('div.phone-number-input').append(this.input.render().el);
    },

    events: {
      'submit .send': 'send',
      'close': 'remove'
    },

    send: function(e) {
      e.preventDefault();
      var number = this.input.validateNumber();
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
