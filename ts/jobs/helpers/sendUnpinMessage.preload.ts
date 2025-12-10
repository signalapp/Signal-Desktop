// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UnpinMessageJobData } from '../conversationJobQueue.preload.js';
import { createSendMessageJob } from './createSendMessageJob.preload.js';

export const sendUnpinMessage = createSendMessageJob<UnpinMessageJobData>({
  sendName: 'sendUnpinMessage',
  sendType: 'unpinMessage',
  getMessageId(data) {
    return data.targetMessageId;
  },
  getMessageOptions(data, jobTimestamp) {
    return {
      timestamp: jobTimestamp,
      unpinMessage: {
        targetAuthorAci: data.targetAuthorAci,
        targetSentTimestamp: data.targetSentTimestamp,
      },
    };
  },
});
