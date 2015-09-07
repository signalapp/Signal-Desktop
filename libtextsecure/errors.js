/*
 * vim: ts=4:sw=4:expandtab
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

    function IncomingIdentityKeyError(number, message, key) {
        ReplayableError.call(this, {
            functionCode : Type.INIT_SESSION,
            args         : [number, message]

        });
        this.name = 'IncomingIdentityKeyError';
        this.message = "The identity of the sender has changed. This may be malicious, or the sender may have simply reinstalled.";
        this.identityKey = key;
        this.number = number.split('.')[0];
    }
    IncomingIdentityKeyError.prototype = new ReplayableError();
    IncomingIdentityKeyError.prototype.constructor = IncomingIdentityKeyError;

    function OutgoingIdentityKeyError(number, message, timestamp, identityKey) {
        ReplayableError.call(this, {
            functionCode : Type.SEND_MESSAGE,
            args         : [number, message, timestamp]
        });
        this.name = 'OutgoingIdentityKeyError';
        this.message = "The identity of the destination has changed. This may be malicious, or the destination may have simply reinstalled.";
        this.number = number.split('.')[0];
        this.identityKey = identityKey;
    }
    OutgoingIdentityKeyError.prototype = new ReplayableError();
    OutgoingIdentityKeyError.prototype.constructor = OutgoingIdentityKeyError;

    window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
    window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
    window.textsecure.ReplayableError = ReplayableError;

})();
