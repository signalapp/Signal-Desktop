// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Donation receipts migration removed for Orbital
// This file provides stub migration to maintain compatibility

import type { WritableDB } from '../Interface.std.js';
import type { LoggerType } from '../../types/Logging.std.js';

export default function updateToSchemaVersion1380(
  _db: WritableDB,
  _logger: LoggerType,
  _startingVersion: number
): void {
  // No-op: donations feature removed
}
