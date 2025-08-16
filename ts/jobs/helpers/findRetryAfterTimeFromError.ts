// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isRecord } from '../../util/isRecord';
import { HTTPError } from '../../textsecure/Errors';
import { parseRetryAfterWithDefault } from '../../util/parseRetryAfter';

export function findRetryAfterTimeFromError(
  err: unknown,
  defaultValue?: number
): number {
  let rawValue: unknown;

  if (isRecord(err)) {
    if (isRecord(err.responseHeaders)) {
      rawValue = err.responseHeaders['retry-after'];
    } else if (err.httpError instanceof HTTPError) {
      rawValue = err.httpError.responseHeaders?.['retry-after'];
    }
  }

  if (Array.isArray(rawValue)) {
    return parseRetryAfterWithDefault(rawValue[0], defaultValue);
  }

  return parseRetryAfterWithDefault(rawValue, defaultValue);
}
