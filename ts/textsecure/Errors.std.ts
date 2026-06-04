// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ChatServiceInactive,
  IoError,
  RateLimitChallengeError,
  RequestUnauthorizedError as LibsignalRequestUnauthorizedError,
  ServiceIdNotFound,
  UntrustedIdentityError,
} from '@signalapp/libsignal-client';

import { parseRetryAfter } from '../util/parseRetryAfter.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import { HTTPError } from '../types/HTTPError.std.ts';
import type { HeaderListType } from '../types/WebAPI.d.ts';

import type { CallbackResultType } from './Types.d.ts';

function appendStack(newError: Error, originalError: Error) {
  // oxlint-disable-next-line no-param-reassign
  newError.stack += `\nOriginal stack:\n${originalError.stack}`;
}

class ReplayableError extends Error {
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

// oxlint-disable-next-line max-classes-per-file
export class OutgoingIdentityKeyError extends ReplayableError {
  public readonly identifier: string;

  // Note: Data to resend message is no longer captured
  constructor(incomingIdentifier: string, cause?: UntrustedIdentityError) {
    const [identifier] = incomingIdentifier.split('.');

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

  readonly error?: Error;

  // Note: Data to resend message is no longer captured
  constructor(incomingIdentifier: string, error?: Error) {
    const [identifier] = incomingIdentifier.split('.', 1);

    super({
      name: 'OutgoingMessageError',
      message: error ? error.message : 'no http error',
    });

    this.identifier = identifier;

    if (error) {
      this.error = error;
      appendStack(this, error);
    }
  }

  get code(): undefined | number {
    return this.error &&
      'code' in this.error &&
      typeof this.error.code === 'number'
      ? this.error.code
      : undefined;
  }
}

export class SendMessageNetworkError extends ReplayableError {
  readonly identifier: string;
  readonly code: number;
  readonly error: HTTPError | IoError | ChatServiceInactive;

  constructor(
    identifier: string,
    error: HTTPError | IoError | ChatServiceInactive
  ) {
    super({
      name: 'SendMessageNetworkError',
      message: error.message,
    });

    const [id] = identifier.split('.', 1);
    this.identifier = id;
    this.error = error;

    if (error instanceof HTTPError) {
      this.code = error.code;
    } else {
      this.code = -1;
    }

    appendStack(this, error);
  }
}

export type SendMessageChallengeData = Readonly<{
  token?: string;
  options?: ReadonlyArray<string>;
}>;

export class SendMessageChallengeError extends ReplayableError {
  public readonly identifier: string;
  public readonly code = 428;
  public readonly error: HTTPError | RateLimitChallengeError;
  public readonly data: SendMessageChallengeData | undefined;
  public readonly retryAt?: number;
  public readonly responseHeaders: HeaderListType | undefined;

  constructor(identifier: string, error: HTTPError | RateLimitChallengeError) {
    super({
      name: 'SendMessageChallengeError',
      message: error.message,
      cause: error,
    });

    const [id] = identifier.split('.', 1);
    this.identifier = id;
    this.error = error;

    if (error instanceof HTTPError) {
      this.responseHeaders = error.responseHeaders;
      this.data = error.response as SendMessageChallengeData;
      const retryAfter = parseRetryAfter(error.responseHeaders['retry-after']);
      if (retryAfter) {
        this.retryAt = Date.now() + retryAfter;
      }
    } else {
      this.data = {
        token: error.token,
        options: [...error.options],
      };
      if (error.retryAfterSecs != null) {
        this.retryAt = Date.now() + error.retryAfterSecs * 1000;
      }
    }
    appendStack(this, error);
  }
}

export class SendMessageProtoError extends Error implements CallbackResultType {
  public readonly successfulServiceIds?: Array<ServiceIdString>;

  public readonly failoverServiceIds?: Array<ServiceIdString>;

  public readonly errors?: CallbackResultType['errors'];

  public readonly unidentifiedDeliveries?: Array<ServiceIdString>;

  public readonly dataMessage: Uint8Array<ArrayBuffer> | undefined;

  public readonly editMessage: Uint8Array<ArrayBuffer> | undefined;

  // Fields necessary for send log save
  public readonly contentHint?: number;

  public readonly contentProto?: Uint8Array<ArrayBuffer>;

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

export class UnregisteredUserError extends Error {
  readonly serviceId: string;
  readonly code: number;
  readonly error: HTTPError | ServiceIdNotFound;

  constructor(
    serviceId: ServiceIdString,
    error: HTTPError | ServiceIdNotFound
  ) {
    const { message } = error;

    super(message);

    this.message = message;
    this.name = 'UnregisteredUserError';

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.serviceId = serviceId;
    this.error = error;
    if (error instanceof HTTPError) {
      this.code = error.code;
    } else {
      this.code = 404;
    }

    appendStack(this, error);
  }
}

export class UnauthorizedMessageSendError extends Error {
  readonly serviceId: ServiceIdString;
  constructor(
    serviceId: ServiceIdString,
    error: HTTPError | LibsignalRequestUnauthorizedError
  ) {
    super(error.message, { cause: error });
    this.serviceId = serviceId;
  }
}

type MismatchedDevicesEntry = {
  serviceId: ServiceIdString;
  staleDevices: Array<number>;
  missingDevices: Array<number>;
  extraDevices: Array<number>;
};
export class MismatchedDevicesError extends Error {
  readonly entries: Array<MismatchedDevicesEntry>;

  constructor(entries: Array<MismatchedDevicesEntry>) {
    super('MismatchedDevicesError');
    this.entries = entries;
  }
}

export class ConnectTimeoutError extends Error {}

export class UnknownRecipientError extends Error {}

export class IncorrectSenderKeyAuthError extends Error {}

export class WarnOnlyError extends Error {}

export class NoSenderKeyError extends Error {}
