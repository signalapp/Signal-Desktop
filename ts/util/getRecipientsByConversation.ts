// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.js';
import type { RecipientsByConversation } from '../state/ducks/stories.js';
import type { ServiceIdString } from '../types/ServiceId.js';

import { getConversationMembers } from './getConversationMembers.js';
import { isNotNil } from './isNotNil.js';

export function getRecipientsByConversation(
  conversations: Array<ConversationAttributesType>
): RecipientsByConversation {
  const recipientsByConversation: Record<
    string,
    {
      serviceIds: Array<ServiceIdString>;
    }
  > = {};

  conversations.forEach(attributes => {
    recipientsByConversation[attributes.id] = {
      serviceIds: getConversationMembers(attributes)
        .map(member => member.serviceId)
        .filter(isNotNil),
    };
  });

  return recipientsByConversation;
}
