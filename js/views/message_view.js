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
(function () {
  'use strict';

  var ErrorView = Backbone.View.extend({
      className: 'error',
      events: {
          'click' : 'replay'
      },
      replay: function() {
          new window.textsecure.ReplayableError(this.model).replay();
      },
      render: function() {
          this.$el.text(this.model.message);
          return this;
      }
  });

  window.Whisper = window.Whisper || {};

  Whisper.MessageView = Backbone.View.extend({
    tagName:   "li",
    className: "entry",

    initialize: function() {
      var groupUpdate = this.model.get('group_update');
      this.$el.addClass(this.model.get('type'));

      if (groupUpdate) {
          this.group_update_view = new Whisper.GroupUpdateView({
              model: groupUpdate
          }).render();
      } else {
        this.template = $('#message').html();
      }
      Mustache.parse(this.template);

      this.listenTo(this.model, 'change',  this.render); // auto update
      this.listenTo(this.model, 'destroy', this.remove); // auto update

    },

    render: function() {
        if (this.group_update_view) {
            this.$el.append(this.group_update_view.$el);
        } else {
            this.$el.html(
                Mustache.render(this.template, {
                    message: this.model.get('body'),
                    timestamp: moment(this.model.get('received_at')).fromNow(),
                    bubble_class: this.model.get('type') === 'outgoing' ? 'sent' : 'incoming',
                    sender: this.model.get('source')
                })
            );

            this.$el.find('.attachments').append(
                this.model.get('attachments').map(function(attachment) {
                    return new Whisper.AttachmentView({model: attachment}).render().el;
                })
            );

            if (this.model.get('delivered')) {
                this.$el.addClass('delivered');
            }

            var errors = this.model.get('errors');
            if (errors && errors.length) {
                this.$el.find('.message').append(
                    errors.map(function(error) {
                        return new ErrorView({model: error}).render().el;
                    })
                );
            }
        }

        return this;
    }

  });

})();
