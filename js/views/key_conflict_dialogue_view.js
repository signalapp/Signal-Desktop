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

    Whisper.KeyConflictDialogueView = Backbone.View.extend({
        className: 'key-conflict-dialogue',
        initialize: function(options) {
            this.template = $('#key-conflict-dialogue').html();
            Mustache.parse(this.template);
            this.conversation = options.conversation;
        },
        events: {
            'click .verify': 'triggerVerify',
            'click .resolve': 'resolve',
            'click .cancel': 'remove',
            'click': 'clickOut'
        },
        triggerVerify: function() {
            this.trigger('verify', {identityKey: this.model.identityKey});
        },
        clickOut: function(e) {
            if (!$(e.target).closest('.content').length) {
                this.remove();
            }
        },
        resolve: function() {
            new Promise(function(resolve) {
                this.conversation.resolveConflicts(this.model).then(resolve);
            }.bind(this));
            this.trigger('resolve');
            this.remove();
        },
        render: function() {
            this.$el.html(Mustache.render(this.template, this.model));
            return this;
        }
    });
})();
