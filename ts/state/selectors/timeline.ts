// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { TimelineItemType } from '../../components/conversation/TimelineItem';

import type { StateType } from '../reducer';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getTargetedMessage,
  getMessages,
  getSelectedMessageIds,
} from './conversations';
import { getAccountSelector } from './accounts';
import {
  getRegionCode,
  getUserConversationId,
  getUserNumber,
  getUserACI,
  getUserPNI,
} from './user';
import { getActiveCall, getCallSelector } from './calling';
import { getPropsForBubble } from './message';

export const getTimelineItem = (
  state: StateType,
  id?: string
): TimelineItemType | undefined => {
  if (id === undefined) {
    return undefined;
  }

  const messageLookup = getMessages(state);

  const message = messageLookup[id];
  if (!message) {
    return undefined;
  }

  const targetedMessage = getTargetedMessage(state);
  const conversationSelector = getConversationSelector(state);
  const regionCode = getRegionCode(state);
  const ourNumber = getUserNumber(state);
  const ourACI = getUserACI(state);
  const ourPNI = getUserPNI(state);
  const ourConversationId = getUserConversationId(state);
  const callSelector = getCallSelector(state);
  const activeCall = getActiveCall(state);
  const accountSelector = getAccountSelector(state);
  const contactNameColorSelector = getContactNameColorSelector(state);
  const selectedMessageIds = getSelectedMessageIds(state);

  return getPropsForBubble(message, {
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourACI,
    ourPNI,
    regionCode,
    targetedMessageId: targetedMessage?.id,
    targetedMessageCounter: targetedMessage?.counter,
    contactNameColorSelector,
    callSelector,
    activeCall,
    accountSelector,
    selectedMessageIds,
  });
};
