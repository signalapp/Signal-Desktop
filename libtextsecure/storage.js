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

    window.textsecure.storage = {

        /*****************************
        *** Base Storage Routines ***
        *****************************/
        putEncrypted: function(key, value) {
            //TODO
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("e" + key, textsecure.utils.jsonThing(value));
        },

        getEncrypted: function(key, defaultValue) {
            //TODO
            var value = localStorage.getItem("e" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        removeEncrypted: function(key) {
            localStorage.removeItem("e" + key);
        },

        putUnencrypted: function(key, value) {
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("u" + key, textsecure.utils.jsonThing(value));
        },

        getUnencrypted: function(key, defaultValue) {
            var value = localStorage.getItem("u" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        removeUnencrypted: function(key) {
            localStorage.removeItem("u" + key);
        }
    };
})();

