// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../../../model-types.std.ts';
import { DAY } from '../../../util/durations/constants.std.ts';
import { DurationInSeconds } from '../../../util/durations/duration-in-seconds.std.ts';
import { calculateExpirationTimestamp } from '../../../util/expirationTimer.std.ts';
import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import type { BackupContentPolicy } from '../policy.std.ts';

export const MINIMUM_LIFETIME = DAY;

export function canIncludeExpiringMessageInBackup({
  message,
  expiringMessagesPolicy,
  now,
}: {
  message: MessageAttributesType;
  expiringMessagesPolicy: BackupContentPolicy['expiringMessages'];
  now: number;
}): boolean {
  if (!message.expireTimer) {
    return true;
  }

  switch (expiringMessagesPolicy) {
    case 'exclude-all':
      return false;
    case 'include-all': {
      const expirationTimestamp = calculateExpirationTimestamp(message) ?? null;
      return expirationTimestamp == null || expirationTimestamp > now;
    }
    case 'exclude-short-lived': {
      // Exclude if the expire timer is <= 24h hours, even if the timer has not yet started
      if (DurationInSeconds.toMillis(message.expireTimer) <= MINIMUM_LIFETIME) {
        return false;
      }

      const expirationTimestamp = calculateExpirationTimestamp(message) ?? null;
      if (expirationTimestamp == null) {
        return true;
      }

      return expirationTimestamp > now + MINIMUM_LIFETIME;
    }
    default:
      throw missingCaseError(expiringMessagesPolicy);
  }
}
