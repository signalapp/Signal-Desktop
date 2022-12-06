// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';
import type { RecipientsByConversation } from '../state/ducks/stories';

import * as log from '../logging/log';
import { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified';
import { getConversationMembers } from './getConversationMembers';
import { UUID } from '../types/UUID';
import { isNotNil } from './isNotNil';

export async function isCallSafe(
  attributes: ConversationAttributesType
): Promise<boolean> {
  const recipientsByConversation: RecipientsByConversation = {
    [attributes.id]: {
      uuids: getConversationMembers(attributes)
        .map(member =>
          member.uuid ? UUID.checkedLookup(member.uuid).toString() : undefined
        )
        .filter(isNotNil),
    },
  };

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
