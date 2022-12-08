// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';

import * as log from '../logging/log';
import { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified';
import { getRecipientsByConversation } from './getRecipientsByConversation';

export async function isCallSafe(
  attributes: ConversationAttributesType
): Promise<boolean> {
  const recipientsByConversation = getRecipientsByConversation([attributes]);

  const callAnyway = await blockSendUntilConversationsAreVerified(
    recipientsByConversation,
    SafetyNumberChangeSource.Calling
  );

  if (!callAnyway) {
    log.info('Safety number change dialog not accepted, new call not allowed.');
    return false;
  }

  return true;
}
