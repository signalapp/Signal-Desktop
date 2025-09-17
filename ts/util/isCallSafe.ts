// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.js';

import { createLogger } from '../logging/log.js';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified.js';
import { getRecipientsByConversation } from './getRecipientsByConversation.js';

import type { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog.js';

const log = createLogger('isCallSafe');

export async function isCallSafe(
  attributes: ConversationAttributesType,
  source: SafetyNumberChangeSource
): Promise<boolean> {
  const recipientsByConversation = getRecipientsByConversation([attributes]);

  const callAnyway = await blockSendUntilConversationsAreVerified(
    recipientsByConversation,
    source
  );

  if (!callAnyway) {
    log.info('Safety number change dialog not accepted, new call not allowed.');
    return false;
  }

  return true;
}
