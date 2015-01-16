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
    },
    initialize: function() {
      this.template = $('#contact').html();
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change', this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update
      this.listenTo(this.model, 'open', this.open);
    },

    open: function(e) {
      var modelId = this.model.id;

      this.$el.addClass('selected');

      if (!this.view) {
        this.view = new Whisper.ConversationView({ model: this.model });
      }

      chrome.windows.create({
        url: 'conversation.html#' + modelId,
        type: 'panel',
        focused: true,
        width: 280,
        height: 420
      }, function (windowInfo) {
        extension.trigger('log', 'maybe up here?');
        extension.trigger('log', localStorage.getItem('idPairs'));

        var idPairs = JSON.parse(localStorage.getItem('idPairs') || '{}');
        idPairs[windowInfo.id] = modelId;
        localStorage.setItem('idPairs', JSON.stringify(idPairs));
        extension.trigger('log', 'set idPairs item');
      });

      this.model.collection.trigger('selected', this.view);
    },

    render: function() {
      this.$el.html(
        Mustache.render(this.template, {
          contact_name: this.model.get('name') || this.model.get('members') || this.model.id,
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
