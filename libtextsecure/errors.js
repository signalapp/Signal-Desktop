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

  function EmptySwarmError(number, message) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split('.')[0];

    ReplayableError.call(this, {
      name: 'EmptySwarmError',
      message,
    });
  }
  inherit(ReplayableError, EmptySwarmError);

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

  function DNSResolutionError(message) {
    // eslint-disable-next-line prefer-destructuring

    ReplayableError.call(this, {
      name: 'DNSResolutionError',
      message: `Error resolving url: ${message}`,
    });
  }
  inherit(ReplayableError, DNSResolutionError);

  function NotFoundError(message, error) {
    this.name = 'NotFoundError';
    this.message = message;
    this.error = error;

    Error.call(this, message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    appendStack(this, error);
  }

  function SeedNodeError(message) {
    this.name = 'SeedNodeError';
    this.message = message;
    Error.call(this, message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }

  function HTTPError(message, response) {
    this.name = 'HTTPError';
    this.message = `${response.status} Error: ${message}`;
    this.response = response;

    Error.call(this, message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }

  function WrongSwarmError(newSwarm) {
    this.name = 'WrongSwarmError';
    this.newSwarm = newSwarm;

    Error.call(this, this.name);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }

  function WrongDifficultyError(newDifficulty) {
    this.name = 'WrongDifficultyError';
    this.newDifficulty = newDifficulty;

    Error.call(this, this.name);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }

  function PublicTokenError(message) {
    this.name = 'PublicTokenError';

    ReplayableError.call(this, {
      name: 'PublicTokenError',
      message,
    });
  }
  inherit(ReplayableError, PublicTokenError);

  function TimestampError(message) {
    this.name = 'TimeStampError';

    ReplayableError.call(this, {
      name: 'TimestampError',
      message,
    });
  }
  inherit(ReplayableError, TimestampError);

  function PublicChatError(message) {
    this.name = 'PublicChatError';
    this.message = message;
    Error.call(this, message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }

  window.textsecure.UnregisteredUserError = UnregisteredUserError;
  window.textsecure.SendMessageNetworkError = SendMessageNetworkError;
  window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
  window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
  window.textsecure.ReplayableError = ReplayableError;
  window.textsecure.OutgoingMessageError = OutgoingMessageError;
  window.textsecure.MessageError = MessageError;
  window.textsecure.SignedPreKeyRotationError = SignedPreKeyRotationError;
  window.textsecure.PoWError = PoWError;
  window.textsecure.EmptySwarmError = EmptySwarmError;
  window.textsecure.SeedNodeError = SeedNodeError;
  window.textsecure.DNSResolutionError = DNSResolutionError;
  window.textsecure.HTTPError = HTTPError;
  window.textsecure.NotFoundError = NotFoundError;
  window.textsecure.WrongSwarmError = WrongSwarmError;
  window.textsecure.WrongDifficultyError = WrongDifficultyError;
  window.textsecure.TimestampError = TimestampError;
  window.textsecure.PublicChatError = PublicChatError;
  window.textsecure.PublicTokenError = PublicTokenError;
})();
