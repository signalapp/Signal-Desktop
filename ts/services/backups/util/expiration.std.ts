// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DAY } from '../../../util/durations/constants.std.js';

// Messages that expire with 24 hours are excluded from regular backups (and their
// attachments may not be backed up), but they will be present in link & sync backups
const EXCLUDE_MESSAGE_FROM_BACKUP_IF_EXPIRING_WITHIN_MS = DAY;

export function expiresTooSoonForBackup({
  messageExpiresAt,
}: {
  messageExpiresAt: number | null;
}): boolean {
  if (messageExpiresAt == null) {
    return false;
  }
  return (
    messageExpiresAt <=
    Date.now() + EXCLUDE_MESSAGE_FROM_BACKUP_IF_EXPIRING_WITHIN_MS
  );
}
