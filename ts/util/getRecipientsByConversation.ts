// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';
import type { RecipientsByConversation } from '../state/ducks/stories';

import { getConversationMembers } from './getConversationMembers';
import { UUID } from '../types/UUID';
import { isNotNil } from './isNotNil';

export function getRecipientsByConversation(
  conversations: Array<ConversationAttributesType>
): RecipientsByConversation {
  const recipientsByConversation: RecipientsByConversation = {};

  conversations.forEach(attributes => {
    recipientsByConversation[attributes.id] = {
      uuids: getConversationMembers(attributes)
        .map(member =>
          member.uuid ? UUID.checkedLookup(member.uuid).toString() : undefined
        )
        .filter(isNotNil),
    };
  });

  return recipientsByConversation;
}
