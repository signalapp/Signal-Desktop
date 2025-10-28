// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import { cleanKeys } from './920-clean-more-keys.std.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { sqlFragment } from '../util.std.js';

// Note: for many users, this is not what ran for them as migration 87. You can see that
//   migration here: https://github.com/signalapp/Signal-Desktop/commit/671e16ae1f869627f355113d6397ccb62d5461d2

// The goal of this migration is to ensure that key cleanup happens before migration 88.

export default function updateToSchemaVersion87(
  db: Database,
  logger: LoggerType,
  startingVersion: number
): void {
  // We're checking for the version of the next migration here, not this version. We want
  //   this to run if the user hasn't yet successfully run migration 88.
  if (startingVersion >= 88) {
    return;
  }

  cleanKeys(
    db,
    logger,
    '(cleanup)/kyberPreKeys',
    sqlFragment`kyberPreKeys`,
    sqlFragment`createdAt`,
    sqlFragment`ourUuid`
  );
  cleanKeys(
    db,
    logger,
    '(cleanup)/preKeys',
    sqlFragment`preKeys`,
    sqlFragment`createdAt`,
    sqlFragment`ourUuid`
  );
  cleanKeys(
    db,
    logger,
    '(cleanup)/signedPreKeys',
    sqlFragment`signedPreKeys`,
    sqlFragment`created_at`,
    sqlFragment`ourUuid`
  );
}
