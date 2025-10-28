// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { RecipientsByConversation } from '../state/ducks/stories.preload.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';

import { getConversationMembers } from './getConversationMembers.dom.js';
import { isNotNil } from './isNotNil.std.js';

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
