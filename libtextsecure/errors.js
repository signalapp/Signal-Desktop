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

    var registeredFunctions = {};
    var Type = {
        SEND_MESSAGE: 1,
        INIT_SESSION: 2,
    };
    window.textsecure = window.textsecure || {};
    window.textsecure.replay = {
        Type: Type,
        registerFunction: function(func, functionCode) {
            registeredFunctions[functionCode] = func;
        }
    };

    function ReplayableError(options) {
        options = options || {};
        this.name         = options.name || 'ReplayableError';
        this.functionCode = options.functionCode;
        this.args         = options.args;
    }
    ReplayableError.prototype = new Error();
    ReplayableError.prototype.constructor = ReplayableError;

    ReplayableError.prototype.replay = function() {
        return registeredFunctions[this.functionCode].apply(window, this.args);
    };

    function IncomingIdentityKeyError(number, message) {
        ReplayableError.call(this, {
            functionCode : Type.INIT_SESSION,
            args         : [number, message]

        });
        this.name = 'IncomingIdentityKeyError';
        this.message = "The identity of the sender has changed. This may be malicious, or the sender may have simply reinstalled TextSecure.";
        this.number = number.split('.')[0];
    }
    IncomingIdentityKeyError.prototype = new ReplayableError();
    IncomingIdentityKeyError.prototype.constructor = IncomingIdentityKeyError;

    function OutgoingIdentityKeyError(number, message, timestamp) {
        ReplayableError.call(this, {
            functionCode : Type.SEND_MESSAGE,
            args         : [number, message, timestamp]
        });
        this.name = 'OutgoingIdentityKeyError';
        this.message = "The identity of the destination has changed. This may be malicious, or the destination may have simply reinstalled TextSecure.";
        this.number = number.split('.')[0];
    }
    OutgoingIdentityKeyError.prototype = new ReplayableError();
    OutgoingIdentityKeyError.prototype.constructor = OutgoingIdentityKeyError;

    window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
    window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
    window.textsecure.ReplayableError = ReplayableError;

})();
