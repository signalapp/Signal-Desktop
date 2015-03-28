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

    window.Whisper = window.Whisper || {};
    var bg = extension.windows.getBackground();

    var SocketView = Whisper.View.extend({
        className: 'status',
        initialize: function() {
            setInterval(function() {
                var className, message = '';
                switch(bg.getSocketStatus && bg.getSocketStatus()) {
                    case WebSocket.CONNECTING:
                        className = 'connecting';
                        break;
                    case WebSocket.OPEN:
                        className = 'open';
                        break;
                    case WebSocket.CLOSING:
                        className = 'closing';
                        break;
                    case WebSocket.CLOSED:
                        className = 'closed';
                        message = 'Websocket closed';
                        break;
                }
                if (!this.$el.hasClass(className)) {
                    this.$el.attr('class', className);
                    this.$el.text(message);
                }
            }.bind(this), 1000);
        },
        events: {
            'click': 'reloadBackgroundPage'
        },
        reloadBackgroundPage: function() {
            bg.location.reload();
        }
    });

    Whisper.InboxView = Whisper.View.extend({
        template: $('#inbox').html(),
        className: 'inbox',
        initialize: function () {
            this.render();

            this.newConversationView = new Whisper.NewConversationView();
            this.newConversationView.$el.hide();
            this.listenTo(this.newConversationView, 'open',
                this.openConversation.bind(this, null));

            this.inbox = new Whisper.ConversationListView({
                el         : this.$('.conversations'),
                collection : bg.inbox
            }).render();

            this.inbox.listenTo(bg.inbox, 'sort', this.inbox.render);

            new SocketView().render().$el.appendTo(this.$('.socket-status'));

            window.addEventListener('beforeunload', function () {
                this.inbox.stopListening();
            }.bind(this));
        },
        events: {
            'click .fab': 'showCompose',
            'select .contact': 'openConversation',
        },
        openConversation: function(e, data) {
            bg.openConversation(data.modelId);
            this.hideCompose();
        },
        showCompose: function() {
            this.newConversationView.reset();
            this.$el.hide();
            this.newConversationView.$el.insertAfter(this.$el);
            this.newConversationView.$el.show();
            this.newConversationView.$input.focus();
            this.listenToOnce(this.newConversationView, 'back', this.hideCompose);
        },
        hideCompose: function() {
            this.newConversationView.$el.hide();
            this.$el.show();
        }
    });

})();
