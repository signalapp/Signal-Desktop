// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { parseRetryAfter } from '../util/parseRetryAfter';

import type { CallbackResultType } from './Types.d';
import type { HeaderListType } from './WebAPI';

function appendStack(newError: Error, originalError: Error) {
  // eslint-disable-next-line no-param-reassign
  newError.stack += `\nOriginal stack:\n${originalError.stack}`;
}

export type HTTPErrorHeadersType = {
  [name: string]: string | ReadonlyArray<string>;
};

export class HTTPError extends Error {
  public override readonly name = 'HTTPError';

  public readonly code: number;

  public readonly responseHeaders: HTTPErrorHeadersType;

  public readonly response: unknown;

  constructor(
    message: string,
    options: {
      code: number;
      headers: HTTPErrorHeadersType;
      response?: unknown;
      stack?: string;
    }
  ) {
    super(`${message}; code: ${options.code}`);

    const { code: providedCode, headers, response, stack } = options;

    this.code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
    this.responseHeaders = headers;

    this.stack += `\nOriginal stack:\n${stack}`;
    this.response = response;
  }
}

export class ReplayableError extends Error {
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

  // Note: Data to resend message is no longer captured
  constructor(incomingIdentifier: string) {
    const identifier = incomingIdentifier.split('.')[0];

    super({
      name: 'OutgoingIdentityKeyError',
      message: `The identity of ${identifier} has changed.`,
    });

    this.identifier = identifier;
  }
}

export class OutgoingMessageError extends ReplayableError {
  readonly identifier: string;

  readonly httpError?: HTTPError;

  // Note: Data to resend message is no longer captured
  constructor(
    incomingIdentifier: string,
    _m: unknown,
    _t: unknown,
    httpError?: HTTPError
  ) {
    const identifier = incomingIdentifier.split('.')[0];

    super({
      name: 'OutgoingMessageError',
      message: httpError ? httpError.message : 'no http error',
    });

    this.identifier = identifier;

    if (httpError) {
      this.httpError = httpError;
      appendStack(this, httpError);
    }
  }

  get code(): undefined | number {
    return this.httpError?.code;
  }
}

export class SendMessageNetworkError extends ReplayableError {
  readonly identifier: string;

  readonly httpError: HTTPError;

  constructor(identifier: string, _m: unknown, httpError: HTTPError) {
    super({
      name: 'SendMessageNetworkError',
      message: httpError.message,
    });

    [this.identifier] = identifier.split('.');
    this.httpError = httpError;

    appendStack(this, httpError);
  }

  get code(): number {
    return this.httpError.code;
  }

  get responseHeaders(): undefined | HeaderListType {
    return this.httpError.responseHeaders;
  }
}

export type SendMessageChallengeData = {
  readonly token?: string;
  readonly options?: ReadonlyArray<string>;
};

export class SendMessageChallengeError extends ReplayableError {
  public identifier: string;

  public readonly httpError: HTTPError;

  public readonly data: SendMessageChallengeData | undefined;

  public readonly retryAt?: number;

  constructor(identifier: string, httpError: HTTPError) {
    super({
      name: 'SendMessageChallengeError',
      message: httpError.message,
    });

    [this.identifier] = identifier.split('.');
    this.httpError = httpError;

    this.data = httpError.response as SendMessageChallengeData;

    const headers = httpError.responseHeaders || {};

    const retryAfter = parseRetryAfter(headers['retry-after']);
    if (retryAfter) {
      this.retryAt = Date.now() + retryAfter;
    }

    appendStack(this, httpError);
  }

  get code(): number {
    return this.httpError.code;
  }
}

export class SendMessageProtoError extends Error implements CallbackResultType {
  public readonly successfulIdentifiers?: Array<string>;

  public readonly failoverIdentifiers?: Array<string>;

  public readonly errors?: CallbackResultType['errors'];

  public readonly unidentifiedDeliveries?: Array<string>;

  public readonly dataMessage?: Uint8Array;

  // Fields necessary for send log save
  public readonly contentHint?: number;

  public readonly contentProto?: Uint8Array;

  public readonly timestamp?: number;

  public readonly recipients?: Record<string, Array<number>>;

  public readonly sendIsNotFinal?: boolean;

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
    sendIsNotFinal,
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
    this.sendIsNotFinal = sendIsNotFinal;
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
  readonly httpError: HTTPError;

  constructor(_m: unknown, httpError: HTTPError) {
    super({
      name: 'MessageError',
      message: httpError.message,
    });

    this.httpError = httpError;

    appendStack(this, httpError);
  }

  get code(): number {
    return this.httpError.code;
  }
}

export class UnregisteredUserError extends Error {
  readonly identifier: string;

  readonly httpError: HTTPError;

  constructor(identifier: string, httpError: HTTPError) {
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
    this.httpError = httpError;

    appendStack(this, httpError);
  }

  get code(): number {
    return this.httpError.code;
  }
}

export class ConnectTimeoutError extends Error {}

export class WarnOnlyError extends Error {}
