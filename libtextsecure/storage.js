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

'use strict';

;(function() {

    /************************************************
    *** Utilities to store data in local storage ***
    ************************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    // Overrideable storage implementation
    window.textsecure.storage.impl = {
        /*****************************
        *** Base Storage Routines ***
        *****************************/
        put: function(key, value) {
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("" + key, textsecure.utils.jsonThing(value));
        },

        get: function(key, defaultValue) {
            var value = localStorage.getItem("" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        remove: function(key) {
            localStorage.removeItem("" + key);
        },
    };

    window.textsecure.storage.put = function(key, value) {
        return textsecure.storage.impl.put(key, value);
    };

    window.textsecure.storage.get = function(key, defaultValue) {
        return textsecure.storage.impl.get(key, defaultValue);
    };

    window.textsecure.storage.remove = function(key) {
        return textsecure.storage.impl.remove(key);
    };
})();

