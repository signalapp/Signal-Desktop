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

  // list of conversations, showing user/group and last message sent
  Whisper.ConversationListItemView = Backbone.View.extend({
    tagName: 'div',
    className: 'contact',

    events: {
      'click': 'open',
      'click .checkbox': 'stopPropagation'
    },
    initialize: function() {
      this.template = $('#contact').html();
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update
    },

    open: function(e) {
      this.$el.addClass('selected');
      this.$el.trigger('open', {modelId: this.model.id});
    },

    stopPropagation: function(e) {
        e.stopPropagation();
    },

    render: function() {
      this.$el.html(
        Mustache.render(this.template, {
          contact_name: this.model.getTitle(),
          last_message: this.model.get('lastMessage'),
          last_message_timestamp: moment(this.model.get('timestamp')).format('MMM D')
        })
      );
      if (this.model.get('avatar')) {
        this.$el.find('.avatar').append(
          new Whisper.AttachmentView({model: this.model.get('avatar')}).render().el
        );
      }
      else {
        this.$el.find('.avatar').append(
            $('<img>').attr('src', '/images/default.png')
        );
      }

      return this;
    }

  });
})();
