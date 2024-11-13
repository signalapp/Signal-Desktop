// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Long from 'long';

export class UnsupportedBackupVersion extends Error {
  constructor(version: Long) {
    super(`Unsupported backup version: ${version}`);
  }
}
