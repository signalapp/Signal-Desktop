// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export default function updateToSchemaVersion75(): void {
  // This was previously a FTS5 migration, but we had to reorder the
  // migrations for backports.
  // See: migrations 76 and 77.
}
