// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { PinMessageJobData } from '../conversationJobQueue.preload.js';
import { createSendMessageJob } from './createSendMessageJob.preload.js';

export const sendPinMessage = createSendMessageJob<PinMessageJobData>({
  sendName: 'sendPinMessage',
  sendType: 'pinMessage',
  getMessageId(data) {
    return data.targetMessageId;
  },
  getMessageOptions(data, jobTimestamp) {
    return {
      timestamp: jobTimestamp,
      pinMessage: {
        targetAuthorAci: data.targetAuthorAci,
        targetSentTimestamp: data.targetSentTimestamp,
        pinDurationSeconds: data.pinDurationSeconds,
      },
    };
  },
});
