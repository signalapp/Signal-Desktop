// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isRecord } from '../../util/isRecord';
import { parseIntWithFallback } from '../../util/parseIntWithFallback';

/**
 * Looks for an HTTP code. First tries the top level error, then looks at its `httpError`
 * property.
 */
export function getHttpErrorCode(maybeError: unknown): number {
  if (!isRecord(maybeError)) {
    return -1;
  }

  const maybeTopLevelCode = parseIntWithFallback(maybeError.code, -1);
  if (maybeTopLevelCode !== -1) {
    return maybeTopLevelCode;
  }

  const { httpError } = maybeError;
  if (!isRecord(httpError)) {
    return -1;
  }

  return parseIntWithFallback(httpError.code, -1);
}
