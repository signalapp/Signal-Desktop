// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

import { createLogger } from '../logging/log.std.js';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified.dom.js';
import { getRecipientsByConversation } from './getRecipientsByConversation.dom.js';

import type { SafetyNumberChangeSource } from '../types/SafetyNumberChangeSource.std.js';

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
