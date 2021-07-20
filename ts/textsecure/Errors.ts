// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */

import { parseRetryAfter } from '../util/parseRetryAfter';

import { CallbackResultType } from './Types.d';

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
    _m: unknown,
    _t: unknown,
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

export type SendMessageChallengeData = {
  readonly token?: string;
  readonly options?: ReadonlyArray<string>;
};

export class SendMessageChallengeError extends ReplayableError {
  public identifier: string;

  public readonly data: SendMessageChallengeData | undefined;

  public readonly retryAfter: number;

  constructor(identifier: string, httpError: Error) {
    super({
      name: 'SendMessageChallengeError',
      message: httpError.message,
    });

    [this.identifier] = identifier.split('.');
    this.code = httpError.code;
    this.data = httpError.response;

    const headers = httpError.responseHeaders || {};

    this.retryAfter =
      Date.now() + parseRetryAfter(headers['retry-after'].toString());

    appendStack(this, httpError);
  }
}

export class SendMessageProtoError extends Error implements CallbackResultType {
  public readonly successfulIdentifiers?: Array<string>;

  public readonly failoverIdentifiers?: Array<string>;

  public readonly errors?: CallbackResultType['errors'];

  public readonly unidentifiedDeliveries?: Array<string>;

  public readonly dataMessage?: ArrayBuffer;

  // Fields necesary for send log save
  public readonly contentHint?: number;

  public readonly contentProto?: Uint8Array;

  public readonly timestamp?: number;

  public readonly recipients?: Record<string, Array<number>>;

  constructor({
    successfulIdentifiers,
    failoverIdentifiers,
    errors,
    unidentifiedDeliveries,
    dataMessage,
    contentHint,
    contentProto,
    timestamp,
    recipients,
  }: CallbackResultType) {
    super(`SendMessageProtoError: ${SendMessageProtoError.getMessage(errors)}`);

    this.successfulIdentifiers = successfulIdentifiers;
    this.failoverIdentifiers = failoverIdentifiers;
    this.errors = errors;
    this.unidentifiedDeliveries = unidentifiedDeliveries;
    this.dataMessage = dataMessage;
    this.contentHint = contentHint;
    this.contentProto = contentProto;
    this.timestamp = timestamp;
    this.recipients = recipients;
  }

  protected static getMessage(errors: CallbackResultType['errors']): string {
    if (!errors) {
      return 'No errors';
    }

    return errors
      .map(error => (error.stackForLog ? error.stackForLog : error.toString()))
      .join(', ');
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

export class ConnectTimeoutError extends Error {}
