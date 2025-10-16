// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.std.js';
import { isMoreRecentThan } from './timestamp.std.js';
import { DAY } from './durations/index.std.js';
import { getMessageQueueTime } from './getMessageQueueTime.dom.js';

// Extend range in case the attachment is actually still there (this function is meant to
// be optimistic)
const BUFFER_TIME_ON_TRANSIT_TIER = 5 * DAY;

export function mightStillBeOnTransitTier(
  attachment: Pick<AttachmentType, 'cdnKey' | 'cdnNumber' | 'uploadTimestamp'>
): boolean {
  if (!attachment.cdnKey) {
    return false;
  }
  if (attachment.cdnNumber == null) {
    return false;
  }

  if (!attachment.uploadTimestamp) {
    // Let's be conservative and still assume it might be downloadable
    return true;
  }

  if (
    isMoreRecentThan(
      attachment.uploadTimestamp,
      getMessageQueueTime() + BUFFER_TIME_ON_TRANSIT_TIER
    )
  ) {
    return true;
  }

  return false;
}
