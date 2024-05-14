// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import type { Response } from 'node-fetch';
import type { LibSignalErrorBase } from '@signalapp/libsignal-client';

import { parseRetryAfter } from '../util/parseRetryAfter';
import type { ServiceIdString } from '../types/ServiceId';

import type { CallbackResultType } from './Types.d';
import type { HeaderListType } from './WebAPI';

function appendStack(newError: Error, originalError: Error) {
  // eslint-disable-next-line no-param-reassign
  newError.stack += `\nOriginal stack:\n${originalError.stack}`;
}

export class HTTPError extends Error {
  public override readonly name = 'HTTPError';

  public readonly code: number;

  public readonly responseHeaders: HeaderListType;

  public readonly response: unknown;

  static fromResponse(response: Response): HTTPError {
    return new HTTPError(response.statusText, {
      code: response.status,
      headers: Object.fromEntries(response.headers),
      response,
    });
  }

  constructor(
    message: string,
    options: {
      code: number;
      headers: HeaderListType;
      response?: unknown;
      stack?: string;
      cause?: unknown;
    }
  ) {
    super(`${message}; code: ${options.code}`, { cause: options.cause });

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
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });

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
  public readonly identifier: string;

  // Note: Data to resend message is no longer captured
  constructor(incomingIdentifier: string, cause?: LibSignalErrorBase) {
    const identifier = incomingIdentifier.split('.')[0];

    super({
      name: 'OutgoingIdentityKeyError',
      message: `The identity of ${identifier} has changed.`,
      cause,
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

export type SendMessageChallengeData = Readonly<{
  token?: string;
  options?: ReadonlyArray<string>;
}>;

export class SendMessageChallengeError extends ReplayableError {
  public identifier: string;

  public readonly httpError: HTTPError;

  public readonly data: SendMessageChallengeData | undefined;

  public readonly retryAt?: number;

  constructor(identifier: string, httpError: HTTPError) {
    super({
      name: 'SendMessageChallengeError',
      message: httpError.message,
      cause: httpError,
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
  public readonly successfulServiceIds?: Array<ServiceIdString>;

  public readonly failoverServiceIds?: Array<ServiceIdString>;

  public readonly errors?: CallbackResultType['errors'];

  public readonly unidentifiedDeliveries?: Array<ServiceIdString>;

  public readonly dataMessage: Uint8Array | undefined;

  public readonly editMessage: Uint8Array | undefined;

  // Fields necessary for send log save
  public readonly contentHint?: number;

  public readonly contentProto?: Uint8Array;

  public readonly timestamp?: number;

  public readonly recipients?: Record<ServiceIdString, Array<number>>;

  public readonly sendIsNotFinal?: boolean;

  constructor({
    successfulServiceIds,
    failoverServiceIds,
    errors,
    unidentifiedDeliveries,
    dataMessage,
    editMessage,
    contentHint,
    contentProto,
    timestamp,
    recipients,
    sendIsNotFinal,
  }: CallbackResultType) {
    super(`SendMessageProtoError: ${SendMessageProtoError.getMessage(errors)}`);

    this.successfulServiceIds = successfulServiceIds;
    this.failoverServiceIds = failoverServiceIds;
    this.errors = errors;
    this.unidentifiedDeliveries = unidentifiedDeliveries;
    this.dataMessage = dataMessage;
    this.editMessage = editMessage;
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

    return errors.map(error => error.toString()).join(', ');
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
  readonly serviceId: string;

  readonly httpError: HTTPError;

  constructor(serviceId: ServiceIdString, httpError: HTTPError) {
    const { message } = httpError;

    super(message);

    this.message = message;
    this.name = 'UnregisteredUserError';

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.serviceId = serviceId;
    this.httpError = httpError;

    appendStack(this, httpError);
  }

  get code(): number {
    return this.httpError.code;
  }
}

export class ConnectTimeoutError extends Error {}

export class UnknownRecipientError extends Error {}

export class IncorrectSenderKeyAuthError extends Error {}

export class WarnOnlyError extends Error {}

export class NoSenderKeyError extends Error {}
