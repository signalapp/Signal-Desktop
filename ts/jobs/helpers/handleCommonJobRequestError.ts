// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../logging/log';
import { parseIntWithFallback } from '../../util/parseIntWithFallback';

export function handleCommonJobRequestError(
  err: unknown,
  log: LoggerType
): void {
  if (!(err instanceof Error)) {
    throw err;
  }

  const code = parseIntWithFallback(err.code, -1);
  if (code === 508) {
    log.info('server responded with 508. Giving up on this job');
    return;
  }

  throw err;
}
