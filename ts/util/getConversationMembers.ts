// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { compact } from 'lodash';
import type { ConversationAttributesType } from '../model-types.d';
import type { UUIDStringType } from '../types/UUID';
import { isDirectConversation } from './whatTypeOfConversation';

export function getConversationMembers(
  conversationAttrs: ConversationAttributesType,
  options: { includePendingMembers?: boolean } = {}
): Array<ConversationAttributesType> {
  if (isDirectConversation(conversationAttrs)) {
    return [conversationAttrs];
  }

  if (conversationAttrs.membersV2) {
    const { includePendingMembers } = options;
    const members: Array<{ uuid: UUIDStringType }> = includePendingMembers
      ? [
          ...(conversationAttrs.membersV2 || []),
          ...(conversationAttrs.pendingMembersV2 || []),
        ]
      : conversationAttrs.membersV2 || [];

    return compact(
      members.map(member => {
        const conversation = window.ConversationController.get(member.uuid);

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
