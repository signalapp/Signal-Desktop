/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */

function appendStack(newError: Error, originalError: Error) {
  // eslint-disable-next-line no-param-reassign
  newError.stack += `\nOriginal stack:\n${originalError.stack}`;
}

export class ReplayableError extends Error {
  name: string;

  message: string;

  functionCode?: number;

  constructor(options: {
    name?: string;
    message: string;
    functionCode?: number;
  }) {
    super(options.message);

    this.name = options.name || 'ReplayableError';
    this.message = options.message;

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.functionCode = options.functionCode;
  }
}

export class IncomingIdentityKeyError extends ReplayableError {
  identifier: string;

  identityKey: ArrayBuffer;

  // Note: Data to resend message is no longer captured
  constructor(incomingIdentifier: string, _m: ArrayBuffer, key: ArrayBuffer) {
    const identifer = incomingIdentifier.split('.')[0];

    super({
      name: 'IncomingIdentityKeyError',
      message: `The identity of ${identifer} has changed.`,
    });

    this.identifier = identifer;
    this.identityKey = key;
  }
}

export class OutgoingIdentityKeyError extends ReplayableError {
  identifier: string;

  identityKey: ArrayBuffer;

  // Note: Data to resend message is no longer captured
  constructor(
    incomingIdentifier: string,
    _m: ArrayBuffer,
    _t: number,
    identityKey: ArrayBuffer
  ) {
    const identifier = incomingIdentifier.split('.')[0];

    super({
      name: 'OutgoingIdentityKeyError',
      message: `The identity of ${identifier} has changed.`,
    });

    this.identifier = identifier;
    this.identityKey = identityKey;
  }
}

export class OutgoingMessageError extends ReplayableError {
  identifier: string;

  code?: any;

  // Note: Data to resend message is no longer captured
  constructor(
    incomingIdentifier: string,
    _m: ArrayBuffer,
    _t: number,
    httpError?: Error
  ) {
    const identifier = incomingIdentifier.split('.')[0];

    super({
      name: 'OutgoingMessageError',
      message: httpError ? httpError.message : 'no http error',
    });

    this.identifier = identifier;

    if (httpError) {
      this.code = httpError.code;
      appendStack(this, httpError);
    }
  }
}

export class SendMessageNetworkError extends ReplayableError {
  identifier: string;

  constructor(identifier: string, _m: unknown, httpError: Error) {
    super({
      name: 'SendMessageNetworkError',
      message: httpError.message,
    });

    [this.identifier] = identifier.split('.');
    this.code = httpError.code;

    appendStack(this, httpError);
  }
}

export class SignedPreKeyRotationError extends ReplayableError {
  constructor() {
    super({
      name: 'SignedPreKeyRotationError',
      message: 'Too many signed prekey rotation failures',
    });
  }
}

export class MessageError extends ReplayableError {
  code?: any;

  constructor(_m: unknown, httpError: Error) {
    super({
      name: 'MessageError',
      message: httpError.message,
    });

    this.code = httpError.code;

    appendStack(this, httpError);
  }
}

export class UnregisteredUserError extends Error {
  identifier: string;

  code?: any;

  constructor(identifier: string, httpError: Error) {
    const { message } = httpError;

    super(message);

    this.message = message;
    this.name = 'UnregisteredUserError';

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.identifier = identifier;
    this.code = httpError.code;

    appendStack(this, httpError);
  }
}
