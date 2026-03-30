// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UnpinMessageJobData } from '../conversationJobQueue.preload.ts';
import { createSendMessageJob } from './createSendMessageJob.preload.ts';

export const sendUnpinMessage = createSendMessageJob<UnpinMessageJobData>({
  sendName: 'sendUnpinMessage',
  sendType: 'unpinMessage',
  isSyncOnly(data) {
    return data.isSyncOnly;
  },
  getMessageId(data) {
    return data.targetMessageId;
  },
  getMessageOptions(data) {
    return {
      timestamp: data.unpinnedAt,
      unpinMessage: {
        targetAuthorAci: data.targetAuthorAci,
        targetSentTimestamp: data.targetSentTimestamp,
      },
    };
  },
  getExpirationStartTimestamp(data) {
    return data.unpinnedAt;
  },
});
