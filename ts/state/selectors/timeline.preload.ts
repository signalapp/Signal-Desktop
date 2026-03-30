// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { isEmpty } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';
import type { TimelineItemType } from '../../components/conversation/TimelineItem.dom.tsx';

import type { StateType } from '../reducer.preload.ts';
import {
  getConversationSelector,
  getTargetedMessage,
  getSelectedMessageIds,
  getMessages,
  getCachedConversationMemberColorsSelector,
  getPinnedMessagesMessageIds,
  getSafeConversationWithSameTitle,
  getConversationByServiceIdSelector,
} from './conversations.dom.ts';
import { getAccountSelector } from './accounts.std.ts';
import {
  getRegionCode,
  getUserConversationId,
  getUserNumber,
  getUserACI,
  getUserPNI,
} from './user.std.ts';
import { getDefaultConversationColor } from './items.dom.ts';
import { getActiveCall, getCallSelector } from './calling.std.ts';
import { getPropsForBubble } from './message.preload.ts';
import { getCallHistorySelector } from './callHistory.std.ts';
import { useProxySelector } from '../../hooks/useProxySelector.std.ts';
import type { StateSelector } from '../types.std.ts';
import { ContactSpoofingType } from '../../util/contactSpoofing.std.ts';
import {
  dehydrateCollisionsWithConversations,
  getCollisionsFromMemberships,
  type GroupNameCollisionsWithIdsByTitle,
} from '../../util/groupMemberNameCollisions.std.ts';
import type { ConversationType } from '../ducks/conversations.preload.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.ts';
import type { ContactNameColorType } from '../../types/Colors.std.ts';

const getTimelineItem = (
  state: StateType,
  messageId: string | undefined,
  contactNameColors: Map<string, ContactNameColorType>
): TimelineItemType | undefined => {
  if (messageId === undefined) {
    return undefined;
  }

  const messageLookup = getMessages(state);

  const message = messageLookup[messageId];
  if (!message) {
    return undefined;
  }

  const targetedMessage = getTargetedMessage(state);
  const conversationSelector = getConversationSelector(state);
  const regionCode = getRegionCode(state);
  const ourNumber = getUserNumber(state);
  const ourAci = getUserACI(state);
  const ourPni = getUserPNI(state);
  const ourConversationId = getUserConversationId(state);
  const callSelector = getCallSelector(state);
  const callHistorySelector = getCallHistorySelector(state);
  const activeCall = getActiveCall(state);
  const accountSelector = getAccountSelector(state);
  const pinnedMessagesMessageIds = getPinnedMessagesMessageIds(state);
  const selectedMessageIds = getSelectedMessageIds(state);
  const defaultConversationColor = getDefaultConversationColor(state);

  return getPropsForBubble(message, {
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourAci,
    ourPni,
    regionCode,
    targetedMessageId: targetedMessage?.id,
    targetedMessageCounter: targetedMessage?.counter,
    contactNameColors,
    callSelector,
    callHistorySelector,
    activeCall,
    accountSelector,
    pinnedMessagesMessageIds,
    selectedMessageIds,
    defaultConversationColor,
  });
};

export const useTimelineItem = (
  messageId: string | undefined,
  conversationId: string
): TimelineItemType | undefined => {
  // Generating contact name colors can take a while in large groups. We don't want to do
  // this inside of useProxySelector, since the proxied state invalidates the memoization
  // from createSelector. So we do the expensive part outside of useProxySelector, taking
  // advantage of reselect's global cache.
  const contactNameColors = useSelector(
    getCachedConversationMemberColorsSelector
  )(conversationId);

  return useProxySelector(getTimelineItem, messageId, contactNameColors);
};

export type DirectConversationWithSameTitleContactSpoofingWarning =
  ReadonlyDeep<{
    type: ContactSpoofingType.DirectConversationWithSameTitle;
    safeConversationId: string;
  }>;

export type MultipleGroupMembersWithSameTitleContactSpoofingWarning =
  ReadonlyDeep<{
    type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
    acknowledgedGroupNameCollisions: GroupNameCollisionsWithIdsByTitle;
    groupNameCollisions: GroupNameCollisionsWithIdsByTitle;
  }>;

export type ContactSpoofingWarning = ReadonlyDeep<
  | DirectConversationWithSameTitleContactSpoofingWarning
  | MultipleGroupMembersWithSameTitleContactSpoofingWarning
>;

export type ContactSpoofingWarningSelector = (
  conversation: ConversationType
) => ContactSpoofingWarning | null;

export const getContactSpoofingWarningSelector: StateSelector<ContactSpoofingWarningSelector> =
  createSelector(
    state => state,
    rootState => {
      return (conversation): ContactSpoofingWarning | null => {
        switch (conversation.type) {
          case 'direct':
            if (
              !conversation.acceptedMessageRequest &&
              !conversation.isBlocked
            ) {
              const safeConversation = getSafeConversationWithSameTitle(
                rootState,
                {
                  possiblyUnsafeConversation: conversation,
                }
              );

              if (safeConversation) {
                return {
                  type: ContactSpoofingType.DirectConversationWithSameTitle,
                  safeConversationId: safeConversation.id,
                };
              }
            }
            return null;
          case 'group': {
            if (conversation.left || conversation.groupVersion !== 2) {
              return null;
            }

            const getConversationByServiceId =
              getConversationByServiceIdSelector(rootState);

            const { memberships } = getGroupMemberships(
              conversation,
              getConversationByServiceId
            );
            const groupNameCollisions =
              getCollisionsFromMemberships(memberships);
            const hasGroupMembersWithSameName = !isEmpty(groupNameCollisions);
            if (hasGroupMembersWithSameName) {
              return {
                type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
                acknowledgedGroupNameCollisions:
                  conversation.acknowledgedGroupNameCollisions,
                groupNameCollisions:
                  dehydrateCollisionsWithConversations(groupNameCollisions),
              };
            }

            return null;
          }
          default:
            throw missingCaseError(conversation);
        }
      };
    }
  );
