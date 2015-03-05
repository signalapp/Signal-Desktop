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

    Whisper.KeyVerificationView = Whisper.View.extend({
        className: 'key-verification',
        template: $('#key-verification').html(),
        events: {
            'click .back': 'goBack'
        },
        goBack: function() {
            this.trigger('back');
        },
        splitKey: function(key) {
            // key is a binary string
            return _.map(key, function(chr, i) {
                return ('0' + key.charCodeAt(i).toString(16)).slice(-2);

            });
        },
        attributes: function() {
            return {
                your_key: this.splitKey(this.model.your_key),
                their_key: this.splitKey(this.model.their_key)
            };
        }
    });
})();
