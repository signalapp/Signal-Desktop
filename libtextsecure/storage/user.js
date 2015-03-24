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
    /*********************************************
    *** Utilities to store data about the user ***
    **********************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.user = {
        setNumberAndDeviceId: function(number, deviceId) {
            textsecure.storage.putUnencrypted("number_id", number + "." + deviceId);
        },

        getNumber: function(key, defaultValue) {
            var number_id = textsecure.storage.getUnencrypted("number_id");
            if (number_id === undefined)
                return undefined;
            return textsecure.utils.unencodeNumber(number_id)[0];
        },

        getDeviceId: function(key) {
            var number_id = textsecure.storage.getUnencrypted("number_id");
            if (number_id === undefined)
                return undefined;
            return textsecure.utils.unencodeNumber(number_id)[1];
        }
    };
})();
