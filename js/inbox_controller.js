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

;(function() {
    'use strict';

    /*
     * Provides a persistent collection of conversations for
     * the inbox view. Automatically updates when messages are received.
     *
     */

    window.inbox = new Whisper.ConversationCollection([], {
        comparator: function(model) {
            return -model.active_at;
        }
    });

    function fetch() {
        window.inbox.fetch({
            reset: true,
            index: {
                name: 'inbox', // 'inbox' index on active_at
                order: 'desc'  // ORDER timestamp DESC
            }
            // TODO pagination/infinite scroll
            // limit: 10, offset: page*10,
        });
    }

    extension.on('message', fetch);
    fetch();
})();
