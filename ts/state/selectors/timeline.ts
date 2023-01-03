// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memoize } from '@indutny/sneequals';
import type { TimelineItemType } from '../../components/conversation/TimelineItem';

import type { StateType } from '../reducer';
import type { MessageWithUIFieldsType } from '../ducks/conversations';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getSelectedMessage,
  getMessages,
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

const getTimelineItemInner = memoize(
  (message: MessageWithUIFieldsType, state: StateType): TimelineItemType => {
    const selectedMessage = getSelectedMessage(state);
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

    return getPropsForBubble(message, {
      conversationSelector,
      ourConversationId,
      ourNumber,
      ourACI,
      ourPNI,
      regionCode,
      selectedMessageId: selectedMessage?.id,
      selectedMessageCounter: selectedMessage?.counter,
      contactNameColorSelector,
      callSelector,
      activeCall,
      accountSelector,
    });
  }
);

export const getTimelineItem = (
  state: StateType,
  id: string
): TimelineItemType | undefined => {
  const messageLookup = getMessages(state);

  const message = messageLookup[id];
  if (!message) {
    return undefined;
  }

  return getTimelineItemInner(message, state);
};
