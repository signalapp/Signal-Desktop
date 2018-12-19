/* global window */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  function inherit(Parent, Child) {
    // eslint-disable-next-line no-param-reassign
    Child.prototype = Object.create(Parent.prototype, {
      constructor: {
        value: Child,
        writable: true,
        configurable: true,
      },
    });
  }
  function appendStack(newError, originalError) {
    // eslint-disable-next-line no-param-reassign
    newError.stack += `\nOriginal stack:\n${originalError.stack}`;
  }

  function ReplayableError(options = {}) {
    this.name = options.name || 'ReplayableError';
    this.message = options.message;

    Error.call(this, options.message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.functionCode = options.functionCode;
  }
  inherit(Error, ReplayableError);

  function IncomingIdentityKeyError(number, message, key) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split('.')[0];
    this.identityKey = key;

    ReplayableError.call(this, {
      name: 'IncomingIdentityKeyError',
      message: `The identity of ${this.number} has changed.`,
    });
  }
  inherit(ReplayableError, IncomingIdentityKeyError);

  function OutgoingIdentityKeyError(number, message, timestamp, identityKey) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split('.')[0];
    this.identityKey = identityKey;

    ReplayableError.call(this, {
      name: 'OutgoingIdentityKeyError',
      message: `The identity of ${this.number} has changed.`,
    });
  }
  inherit(ReplayableError, OutgoingIdentityKeyError);

  function OutgoingMessageError(number, message, timestamp, httpError) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split('.')[0];

    ReplayableError.call(this, {
      name: 'OutgoingMessageError',
      message: httpError ? httpError.message : 'no http error',
    });

    if (httpError) {
      this.code = httpError.code;
      appendStack(this, httpError);
    }
  }
  inherit(ReplayableError, OutgoingMessageError);

  function SendMessageNetworkError(number, jsonData, httpError) {
    this.number = number;
    this.code = httpError.code;

    ReplayableError.call(this, {
      name: 'SendMessageNetworkError',
      message: httpError.message,
    });

    appendStack(this, httpError);
  }
  inherit(ReplayableError, SendMessageNetworkError);

  function SignedPreKeyRotationError() {
    ReplayableError.call(this, {
      name: 'SignedPreKeyRotationError',
      message: 'Too many signed prekey rotation failures',
    });
  }
  inherit(ReplayableError, SignedPreKeyRotationError);

  function MessageError(message, httpError) {
    this.code = httpError.code;

    ReplayableError.call(this, {
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

  function PoWError(number, error) {
     // eslint-disable-next-line prefer-destructuring
     this.number = number.split('.')[0];

     ReplayableError.call(this, {
       name: 'PoWError',
       message: 'Failed to calculate PoW',
     });

     if (error) {
       appendStack(this, error);
     }
  }
  inherit(ReplayableError, PoWError);

  window.textsecure.UnregisteredUserError = UnregisteredUserError;
  window.textsecure.SendMessageNetworkError = SendMessageNetworkError;
  window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
  window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
  window.textsecure.ReplayableError = ReplayableError;
  window.textsecure.OutgoingMessageError = OutgoingMessageError;
  window.textsecure.MessageError = MessageError;
  window.textsecure.SignedPreKeyRotationError = SignedPreKeyRotationError;
  window.textsecure.PoWError = PoWError;
})();
