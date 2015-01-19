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

  Whisper.GroupRecipientsInputView = Backbone.View.extend({
    initialize: function() {
      this.$el.tagsinput({ tagClass: this.tagClass });
    },

    tagClass: function(item) {
      try {
        if (libphonenumber.util.verifyNumber(item)) {
          return;
        }
      } catch(ex) {}
      return 'error';
    }
  });

  Whisper.NewGroupView = Backbone.View.extend({
    className: 'conversation',
    initialize: function() {
      this.template = $('#new-group-form').html();
      Mustache.parse(this.template);
      this.$el.html($(Mustache.render(this.template)));
      this.input = this.$el.find('input.number');
      new Whisper.GroupRecipientsInputView({el: this.$el.find('input.numbers')}).$el.appendTo(this.$el);
      this.fileInput = new Whisper.FileInputView({el: this.$el.find('.attachments')});
      this.avatarInput = new Whisper.FileInputView({el: this.$el.find('.group-avatar')});
    },

    events: {
      'submit .send': 'send',
      'close': 'remove'
    },

    send: function(e) {
      e.preventDefault();
      var numbers = this.$el.find('input.numbers').val().split(',');
      var name = this.$el.find('input.name').val();
      var message_input = this.$el.find('input.send-message');
      var message = message_input.val();
      var view = this;
      if (message.length > 0 || this.fileInput.hasFiles()) {
        this.avatarInput.getFiles().then(function(avatar_files) {
          view.collection.createGroup(numbers, name, avatar_files[0]).then(function(convo){
            view.fileInput.getFiles().then(function(attachments) {
                convo.sendMessage(view.$el.find('input.send-message').val());
            });
            convo.trigger('open');
          });
        });
      }
      this.remove();
    }
  });

})();
