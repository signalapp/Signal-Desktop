// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Donation receipts migration removed for Orbital
// This file provides stub migration to maintain compatibility

type Database = any;

export default function updateToSchemaVersion1380(
  _currentVersion: number,
  _db: Database
): void {
  // No-op: donations feature removed
}
