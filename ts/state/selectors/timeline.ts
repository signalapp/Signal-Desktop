// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import type { TimelineItemType } from '../../components/conversation/TimelineItem.dom.js';

import type { StateType } from '../reducer.preload.js';
import {
  getConversationSelector,
  getTargetedMessage,
  getSelectedMessageIds,
  getMessages,
  getCachedConversationMemberColorsSelector,
} from './conversations.dom.js';
import { getAccountSelector } from './accounts.std.js';
import {
  getRegionCode,
  getUserConversationId,
  getUserNumber,
  getUserACI,
  getUserPNI,
} from './user.std.js';
import { getDefaultConversationColor } from './items.dom.js';
import { getActiveCall, getCallSelector } from './calling.std.js';
import { getPropsForBubble } from './message.preload.js';
import { getCallHistorySelector } from './callHistory.std.js';
import { useProxySelector } from '../../hooks/useProxySelector.std.js';

const getTimelineItem = (
  state: StateType,
  messageId: string | undefined,
  contactNameColors: Map<string, string>
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
