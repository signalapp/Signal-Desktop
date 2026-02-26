// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations.preload.js';
import { isDirectConversation } from './whatTypeOfConversation.dom.js';
import {
  isPollSend1to1Enabled,
  isPollSendEnabled,
  type PollCreateType,
} from '../types/Polls.dom.js';

export async function enqueuePollCreateForSend(
  conversation: ConversationModel,
  poll: PollCreateType
): Promise<void> {
  if (!isPollSendEnabled()) {
    throw new Error('enqueuePollCreateForSend: poll sending is not enabled');
  }

  if (
    isDirectConversation(conversation.attributes) &&
    !isPollSend1to1Enabled()
  ) {
    throw new Error(
      'enqueuePollCreateForSend: 1:1 poll sending is not enabled'
    );
  }

  await conversation.enqueueMessageForSend(
    {
      attachments: [],
      body: undefined,
      poll,
    },
    {
      timestamp: Date.now(),
    }
  );
}
