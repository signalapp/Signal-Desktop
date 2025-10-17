// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Response } from 'node-fetch';

import type { HeaderListType } from './WebAPI.d.ts';

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
