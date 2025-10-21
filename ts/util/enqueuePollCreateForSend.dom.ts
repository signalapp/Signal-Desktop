// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations.preload.js';
import { isGroupV2 } from './whatTypeOfConversation.dom.js';
import { isPollSendEnabled, type PollCreateType } from '../types/Polls.dom.js';

export async function enqueuePollCreateForSend(
  conversation: ConversationModel,
  poll: PollCreateType
): Promise<void> {
  if (!isPollSendEnabled()) {
    throw new Error('enqueuePollCreateForSend: poll sending is not enabled');
  }

  if (!isGroupV2(conversation.attributes)) {
    throw new Error(
      'enqueuePollCreateForSend: polls are group-only. Conversation is not GroupV2.'
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
