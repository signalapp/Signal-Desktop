// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { PinMessageJobData } from '../conversationJobQueue.preload.ts';
import { createSendMessageJob } from './createSendMessageJob.preload.ts';

export const sendPinMessage = createSendMessageJob<PinMessageJobData>({
  sendName: 'sendPinMessage',
  sendType: 'pinMessage',
  isSyncOnly() {
    return false;
  },
  getMessageId(data) {
    return data.targetMessageId;
  },
  getMessageOptions(data) {
    return {
      timestamp: data.pinnedAt,
      pinMessage: {
        targetAuthorAci: data.targetAuthorAci,
        targetSentTimestamp: data.targetSentTimestamp,
        pinDurationSeconds: data.pinDurationSeconds,
      },
    };
  },
  getExpirationStartTimestamp(data) {
    return data.pinnedAt;
  },
});
