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

    var Message  = Backbone.Model.extend({
        database: Whisper.Database,
        storeName: 'messages',
        defaults: function() { return { timestamp: new Date().getTime() }; },
        validate: function(attributes, options) {
            var required = ['timestamp', 'conversationId'];
            var missing = _.filter(required, function(attr) { return !attributes[attr]; });
            if (missing.length) {
                console.log("Message missing attributes: " + missing);
            }
        },

        conversation: function() {
            return Whisper.Conversations.get(this.get('conversationId'));
        }
    });

    Whisper.MessageCollection = Backbone.Collection.extend({
        model: Message,
        database: Whisper.Database,
        storeName: 'messages',
        comparator: function(m) { return -m.get('timestamp'); },
        destroyAll: function () {
            return Promise.all(this.models.map(function(m) {
                return new Promise(function(resolve, reject) {
                    m.destroy().then(resolve).fail(reject);
                });
            }));
        }
    });
})()
