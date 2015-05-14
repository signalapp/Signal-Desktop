/* vim: ts=4:sw=4
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
    window.Whisper = window.Whisper || {};
    var Item = Backbone.Model.extend({
      database: Whisper.Database,
      storeName: 'items'
    });
    var ItemCollection = Backbone.Collection.extend({
        model: Item,
        storeName: 'items',
        database: Whisper.Database,
    });

    var ready = false;
    var items = new ItemCollection();
    items.on('reset', function() { ready = true; });
    window.storage = {
        /*****************************
        *** Base Storage Routines ***
        *****************************/
        put: function(key, value) {
            if (value === undefined)
                throw new Error("Tried to store undefined");
            var item = items.add({id: key, value: value});
            item.save();
        },

        get: function(key, defaultValue) {
            var item = items.get("" + key);
            if (!item)
                return defaultValue;
            return item.get('value');
        },

        remove: function(key) {
            var item = items.get("" + key);
            if (item) {
                items.remove(item);
                item.destroy();
            }
        },

        onready: function(callback) {
            if (ready) {
                callback();
            } else {
                items.on('reset', callback);
            }
        },

        fetch: function() {
            return new Promise(function(resolve) {
                items.fetch({reset: true}).always(resolve);
            });
        }
    };
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};
    window.textsecure.storage.impl = window.storage;
})();
