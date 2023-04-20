// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';

export async function timeAndLogIfTooLong(
  threshold: number,
  func: () => Promise<unknown>,
  getLogLine: (duration: number) => string
): Promise<void> {
  const start = Date.now();
  try {
    await func();
  } finally {
    const duration = Date.now() - start;
    if (duration > threshold) {
      log.info(getLogLine(duration));
    }
  }
}
