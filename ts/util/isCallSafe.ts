// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';

import { createLogger } from '../logging/log';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified';
import { getRecipientsByConversation } from './getRecipientsByConversation';

import type { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';

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
