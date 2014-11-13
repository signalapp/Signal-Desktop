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

  Whisper.ConversationView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.stopListening); // auto update
      this.template = $('#conversation').html();
      Mustache.parse(this.template);
      this.$el.html(Mustache.render(this.template));

      this.view = new Whisper.MessageListView({collection: this.model.messages()});

      this.fileInput = new Whisper.FileInputView({el: this.$el.find('.attachments')});

      this.model.messages().fetch({reset: true});
      this.$el.find('.discussion-container').append(this.view.el);
      window.addEventListener('storage', (function(){
        this.model.messages().fetch();
      }).bind(this));
    },
    events: {
      'submit .send': 'sendMessage',
      'close': 'remove'
    },

    sendMessage: function(e) {
      e.preventDefault();
      var input = this.$el.find('.send input');
      var message = input.val();
      var convo = this.model;

      if (message.length > 0 || this.fileInput.hasFiles()) {
        this.fileInput.getFiles().then(function(attachments) {
          convo.sendMessage(message, attachments);
        });
        input.val("");
      }
    },

    render: function() {
      Whisper.Layout.setContent(this.$el.show());
      this.view.scrollToBottom();
      return this;
    }
  });
})();
