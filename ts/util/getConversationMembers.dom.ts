// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { isDirectConversation } from './whatTypeOfConversation.dom.js';

const { compact } = lodash;

export function getConversationMembers(
  conversationAttrs: ConversationAttributesType,
  options: { includePendingMembers?: boolean } = {}
): Array<ConversationAttributesType> {
  if (isDirectConversation(conversationAttrs)) {
    return [conversationAttrs];
  }

  if (conversationAttrs.membersV2) {
    const { includePendingMembers } = options;
    const members: Array<ServiceIdString> = includePendingMembers
      ? [
          ...(conversationAttrs.membersV2 || []).map(({ aci }) => aci),
          ...(conversationAttrs.pendingMembersV2 || []).map(
            ({ serviceId }) => serviceId
          ),
        ]
      : conversationAttrs.membersV2?.map(({ aci }) => aci) || [];

    return compact(
      members.map(serviceId => {
        const conversation = window.ConversationController.get(serviceId);

        // In groups we won't sent to blocked contacts or those we think are unregistered
        if (
          conversation &&
          (conversation.isUnregistered() || conversation.isBlocked())
        ) {
          return null;
        }

        return conversation?.attributes;
      })
    );
  }

  if (conversationAttrs.members) {
    return compact(
      conversationAttrs.members.map(id => {
        const conversation = window.ConversationController.get(id);

        // In groups we won't sent to blocked contacts or those we think are unregistered
        if (
          conversation &&
          (conversation.isUnregistered() || conversation.isBlocked())
        ) {
          return null;
        }

        return conversation?.attributes;
      })
    );
  }

  return [];
}
