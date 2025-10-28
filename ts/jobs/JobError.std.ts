// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { reallyJsonStringify } from '../util/reallyJsonStringify.std.js';

/**
 * An error that wraps job errors.
 *
 * Should not be instantiated directly, except by `JobQueue`.
 */
export class JobError extends Error {
  constructor(public readonly lastErrorThrownByJob: unknown) {
    super(`Job failed. Last error: ${formatError(lastErrorThrownByJob)}`);
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return reallyJsonStringify(err);
}
