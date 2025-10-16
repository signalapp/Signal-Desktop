// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ParsedJob, StoredJob } from './types.std.js';

/**
 * Format a job to be inserted into the database.
 *
 * Notably, `Job` instances (which have a promise attached) cannot be serialized without
 * some cleanup. That's what this function is most useful for.
 */
export const formatJobForInsert = (
  job: Readonly<StoredJob | ParsedJob<unknown>>
): StoredJob => ({
  id: job.id,
  timestamp: job.timestamp,
  queueType: job.queueType,
  data: job.data,
});
