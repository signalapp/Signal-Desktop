/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';

    var registeredFunctions = {};
    var Type = {
        ENCRYPT_MESSAGE: 1,
        INIT_SESSION: 2,
        TRANSMIT_MESSAGE: 3,
        REBUILD_MESSAGE: 4,
        RETRY_SEND_MESSAGE_PROTO: 5
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
        var argumentsAsArray = Array.prototype.slice.call(arguments, 0);
        var args = this.args.concat(argumentsAsArray);
        return registeredFunctions[this.functionCode].apply(window, args);
    };

    function IncomingIdentityKeyError(number, message, key) {
        ReplayableError.call(this, {
            functionCode : Type.INIT_SESSION,
            args         : [number, message]

        });
        this.number = number.split('.')[0];
        this.name = 'IncomingIdentityKeyError';
        this.message = "The identity of " + this.number + " has changed.";
        this.identityKey = key;
    }
    IncomingIdentityKeyError.prototype = new ReplayableError();
    IncomingIdentityKeyError.prototype.constructor = IncomingIdentityKeyError;

    function OutgoingIdentityKeyError(number, message, timestamp, identityKey) {
        ReplayableError.call(this, {
            functionCode : Type.ENCRYPT_MESSAGE,
            args         : [number, message, timestamp]
        });
        this.number = number.split('.')[0];
        this.name = 'OutgoingIdentityKeyError';
        this.message = "The identity of " + this.number + " has changed.";
        this.identityKey = identityKey;
    }
    OutgoingIdentityKeyError.prototype = new ReplayableError();
    OutgoingIdentityKeyError.prototype.constructor = OutgoingIdentityKeyError;

    function OutgoingMessageError(number, message, timestamp, httpError) {
        ReplayableError.call(this, {
            functionCode : Type.ENCRYPT_MESSAGE,
            args         : [number, message, timestamp]
        });
        this.name = 'OutgoingMessageError';
        if (httpError) {
            this.code = httpError.code;
            this.message = httpError.message;
            this.stack = httpError.stack;
        }
    }
    OutgoingMessageError.prototype = new ReplayableError();
    OutgoingMessageError.prototype.constructor = OutgoingMessageError;

    function SendMessageNetworkError(number, jsonData, httpError, timestamp) {
        ReplayableError.call(this, {
            functionCode : Type.TRANSMIT_MESSAGE,
            args         : [number, jsonData, timestamp]
        });
        this.name = 'SendMessageNetworkError';
        this.number = number;
        this.code = httpError.code;
        this.message = httpError.message;
        this.stack = httpError.stack;
    }
    SendMessageNetworkError.prototype = new ReplayableError();
    SendMessageNetworkError.prototype.constructor = SendMessageNetworkError;

    function SignedPreKeyRotationError(numbers, message, timestamp) {
        ReplayableError.call(this, {
            functionCode : Type.RETRY_SEND_MESSAGE_PROTO,
            args         : [numbers, message, timestamp]
        });
        this.name = 'SignedPreKeyRotationError';
        this.message = "Too many signed prekey rotation failures";
    }
    SignedPreKeyRotationError.prototype = new ReplayableError();
    SignedPreKeyRotationError.prototype.constructor = SignedPreKeyRotationError;

    function MessageError(message, httpError) {
        ReplayableError.call(this, {
            functionCode : Type.REBUILD_MESSAGE,
            args         : [message]
        });
        this.name = 'MessageError';
        this.code = httpError.code;
        this.message = httpError.message;
        this.stack = httpError.stack;
    }
    MessageError.prototype = new ReplayableError();
    MessageError.prototype.constructor = MessageError;

    function UnregisteredUserError(number, httpError) {
        this.name = 'UnregisteredUserError';
        this.number = number;
        this.code = httpError.code;
        this.message = httpError.message;
        this.stack = httpError.stack;
    }
    UnregisteredUserError.prototype = new Error();
    UnregisteredUserError.prototype.constructor = UnregisteredUserError;

    window.textsecure.UnregisteredUserError = UnregisteredUserError;
    window.textsecure.SendMessageNetworkError = SendMessageNetworkError;
    window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
    window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
    window.textsecure.ReplayableError = ReplayableError;
    window.textsecure.OutgoingMessageError = OutgoingMessageError;
    window.textsecure.MessageError = MessageError;
    window.textsecure.SignedPreKeyRotationError = SignedPreKeyRotationError;

})();
