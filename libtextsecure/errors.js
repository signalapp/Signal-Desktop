(function() {
  'use strict';

  var registeredFunctions = {};
  var Type = {
    ENCRYPT_MESSAGE: 1,
    INIT_SESSION: 2,
    TRANSMIT_MESSAGE: 3,
    REBUILD_MESSAGE: 4,
    RETRY_SEND_MESSAGE_PROTO: 5,
  };
  window.textsecure = window.textsecure || {};
  window.textsecure.replay = {
    Type: Type,
    registerFunction: function(func, functionCode) {
      registeredFunctions[functionCode] = func;
    },
  };

  function inherit(Parent, Child) {
    Child.prototype = Object.create(Parent.prototype, {
      constructor: {
        value: Child,
        writable: true,
        configurable: true,
      },
    });
  }
  function appendStack(newError, originalError) {
    newError.stack += '\nOriginal stack:\n' + originalError.stack;
  }

  function ReplayableError(options) {
    options = options || {};
    this.name = options.name || 'ReplayableError';
    this.message = options.message;

    Error.call(this, options.message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.functionCode = options.functionCode;
    this.args = options.args;
  }
  inherit(Error, ReplayableError);

  ReplayableError.prototype.replay = function() {
    var argumentsAsArray = Array.prototype.slice.call(arguments, 0);
    var args = this.args.concat(argumentsAsArray);
    return registeredFunctions[this.functionCode].apply(window, args);
  };

  function IncomingIdentityKeyError(number, message, key) {
    this.number = number.split('.')[0];
    this.identityKey = key;

    ReplayableError.call(this, {
      functionCode: Type.INIT_SESSION,
      args: [number, message],
      name: 'IncomingIdentityKeyError',
      message: 'The identity of ' + this.number + ' has changed.',
    });
  }
  inherit(ReplayableError, IncomingIdentityKeyError);

  function OutgoingIdentityKeyError(number, message, timestamp, identityKey) {
    this.number = number.split('.')[0];
    this.identityKey = identityKey;

    ReplayableError.call(this, {
      functionCode: Type.ENCRYPT_MESSAGE,
      args: [number, message, timestamp],
      name: 'OutgoingIdentityKeyError',
      message: 'The identity of ' + this.number + ' has changed.',
    });
  }
  inherit(ReplayableError, OutgoingIdentityKeyError);

  function OutgoingMessageError(number, message, timestamp, httpError) {
    ReplayableError.call(this, {
      functionCode: Type.ENCRYPT_MESSAGE,
      args: [number, message, timestamp],
      name: 'OutgoingMessageError',
      message: httpError ? httpError.message : 'no http error',
    });

    if (httpError) {
      this.code = httpError.code;
      appendStack(this, httpError);
    }
  }
  inherit(ReplayableError, OutgoingMessageError);

  function SendMessageNetworkError(number, jsonData, httpError, timestamp) {
    this.number = number;
    this.code = httpError.code;

    ReplayableError.call(this, {
      functionCode: Type.TRANSMIT_MESSAGE,
      args: [number, jsonData, timestamp],
      name: 'SendMessageNetworkError',
      message: httpError.message,
    });

    appendStack(this, httpError);
  }
  inherit(ReplayableError, SendMessageNetworkError);

  function SignedPreKeyRotationError(numbers, message, timestamp) {
    ReplayableError.call(this, {
      functionCode: Type.RETRY_SEND_MESSAGE_PROTO,
      args: [numbers, message, timestamp],
      name: 'SignedPreKeyRotationError',
      message: 'Too many signed prekey rotation failures',
    });
  }
  inherit(ReplayableError, SignedPreKeyRotationError);

  function MessageError(message, httpError) {
    this.code = httpError.code;

    ReplayableError.call(this, {
      functionCode: Type.REBUILD_MESSAGE,
      args: [message],
      name: 'MessageError',
      message: httpError.message,
    });

    appendStack(this, httpError);
  }
  inherit(ReplayableError, MessageError);

  function UnregisteredUserError(number, httpError) {
    this.message = httpError.message;
    this.name = 'UnregisteredUserError';

    Error.call(this, this.message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.number = number;
    this.code = httpError.code;

    appendStack(this, httpError);
  }
  inherit(Error, UnregisteredUserError);

  window.textsecure.UnregisteredUserError = UnregisteredUserError;
  window.textsecure.SendMessageNetworkError = SendMessageNetworkError;
  window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
  window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
  window.textsecure.ReplayableError = ReplayableError;
  window.textsecure.OutgoingMessageError = OutgoingMessageError;
  window.textsecure.MessageError = MessageError;
  window.textsecure.SignedPreKeyRotationError = SignedPreKeyRotationError;
})();
