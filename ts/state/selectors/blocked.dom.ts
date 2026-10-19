// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { getConversationSelector } from './conversations.dom.ts';
import {
  getBlockedNumbers,
  getBlockedUuids,
  getBlockedGroups as getBlockGroupsFromItems,
  getReleaseNotesChatBlocked,
  getReleaseNotesChatBlockedAt,
} from './items.dom.ts';
import { SIGNAL_ACI } from '../../types/SignalConversation.std.ts';

import type { GetConversationByIdType } from './conversations.dom.ts';
import type { ConversationType } from '../ducks/conversations.preload.ts';
import type {
  BlockedGroup,
  BlockedNumber,
  BlockedServiceId,
} from '../../types/StorageKeys.std.ts';

export type BlockedConversation = {
  conversation: ConversationType;
  blockedAt: number | undefined;
};

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
function sortConversationTitles(
  left: BlockedConversation,
  right: BlockedConversation
) {
  const leftTitle = left.conversation.title;
  const rightTitle = right.conversation.title;
  return collator.compare(leftTitle, rightTitle);
}

export const getBlockedContacts = createSelector(
  getConversationSelector,
  getBlockedUuids,
  getBlockedNumbers,
  getReleaseNotesChatBlocked,
  getReleaseNotesChatBlockedAt,
  (
    conversationSelector: GetConversationByIdType,
    blockedUuids: ReadonlyArray<BlockedServiceId> | undefined,
    blockedNumbers: ReadonlyArray<BlockedNumber> | undefined,
    releaseNotesChatBlocked: boolean,
    releaseNotesChatBlockedAt: number | undefined
  ): Array<BlockedConversation> => {
    const result = new Map<string, BlockedConversation>();

    (blockedUuids || []).forEach(item => {
      const conversation = conversationSelector(item.serviceId);
      result.set(conversation.id, {
        conversation,
        blockedAt: item.blockedAt,
      });
    });

    (blockedNumbers || []).forEach(item => {
      const conversation = conversationSelector(item.e164);
      if (!result.has(conversation.id)) {
        result.set(conversation.id, {
          conversation,
          blockedAt: item.blockedAt,
        });
      }
    });

    if (releaseNotesChatBlocked) {
      const conversation = conversationSelector(SIGNAL_ACI);
      result.set(conversation.id, {
        conversation,
        blockedAt: releaseNotesChatBlockedAt,
      });
    }

    const list = Array.from(result.values());
    return list.sort(sortConversationTitles);
  }
);

export const getBlockedGroups = createSelector(
  getConversationSelector,
  getBlockGroupsFromItems,
  (
    conversationSelector: GetConversationByIdType,
    blockedGroups: ReadonlyArray<BlockedGroup> | undefined
  ): Array<BlockedConversation> => {
    const result: Array<BlockedConversation> = [];

    (blockedGroups || []).forEach(item => {
      result.push({
        conversation: conversationSelector(item.groupId),
        blockedAt: item.blockedAt,
      });
    });

    return result.sort(sortConversationTitles);
  }
);
