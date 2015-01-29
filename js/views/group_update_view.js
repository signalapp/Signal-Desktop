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

    Whisper.GroupUpdateView = Backbone.View.extend({
        tagName:   "div",
        className: "group-update",
        render: function() {
            //TODO l10n
            var messages = ['Updated the group.'];
            if (this.model.name) {
                messages.push("Title is now '" + this.model.name + "'.");
            }
            if (this.model.joined) {
                messages.push(this.model.joined.join(', ') + ' joined the group');
            }

            this.$el.text(messages.join(' '));

            return this;
        }
    });

})();
