// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { last } from 'lodash';

import { CallMode } from '../types/CallDisposition.std.ts';
import { strictAssert } from './assert.std.ts';
import { getMidnight } from '../types/NotificationProfile.std.ts';
import { SeenStatus } from '../MessageSeenStatus.std.ts';
import { missingCaseError } from './missingCaseError.std.ts';

import type {
  MessageLookupType,
  MessageType,
} from '../state/ducks/conversations.preload.ts';
import type {
  CallSelectorType,
  CallStateType,
} from '../state/selectors/calling.std.ts';
import type { DurationInSeconds } from './durations/duration-in-seconds.std.ts';
import type { CallHistorySelectorType } from '../state/selectors/callHistory.std.ts';

export const MAX_COLLAPSE_SET_SIZE = 50;

export type CollapsedMessage = {
  id: string;
  isUnseen: boolean;
  // A single group-v2-change message can have more than one change in it
  extraItems?: number;
  atDateBoundary?: boolean;
};

export type CollapseSet =
  | {
      type: 'none';
      id: string;
      messages: undefined;
    }
  | {
      type: 'group-updates';
      id: string;
      messages: Array<CollapsedMessage>;
    }
  | {
      type: 'timer-changes';
      id: string;
      endingState: DurationInSeconds | undefined;
      messages: Array<CollapsedMessage>;
    }
  | {
      type: 'call-events';
      id: string;
      messages: Array<CollapsedMessage>;
    };

function canCollapseForGroupSet(message: MessageType): boolean {
  const { type, groupV2Change } = message;

  if (
    type === 'change-number-notification' ||
    type === 'keychange' ||
    type === 'pinned-message-notification' ||
    type === 'poll-terminate' ||
    type === 'profile-change' ||
    type === 'verified-change'
  ) {
    return true;
  }

  if (
    type === 'group-v2-change' &&
    groupV2Change?.details[0]?.type !== 'terminated'
  ) {
    return true;
  }

  return false;
}

function canCollapseForTimerSet(message: MessageType): boolean {
  if (message.type === 'timer-notification') {
    return true;
  }

  // Found some examples of messages with type = 'incoming' and an expirationTimerUpdate
  if (message.expirationTimerUpdate) {
    return true;
  }

  return false;
}

function canCollapseForCallSet(
  message: MessageType,
  options: {
    activeCall: CallStateType | undefined;
    callHistorySelector: CallHistorySelectorType;
    callSelector: (conversationId: string) => CallStateType | undefined;
    getCallIdFromEra: (eraId: string) => string;
  }
): boolean {
  if (message.type !== 'call-history') {
    return false;
  }

  const { callId, conversationId } = message;
  if (!callId) {
    return true;
  }

  const callHistory = options.callHistorySelector(callId);
  if (!callHistory) {
    return true;
  }

  // If a direct call is currently ongoing, we don't want to group it
  if (callHistory.mode === CallMode.Direct) {
    const isActiveCall = options.activeCall?.conversationId === conversationId;

    return !isActiveCall;
  }

  const conversationCall = options.callSelector(conversationId);
  if (!conversationCall) {
    return true;
  }

  strictAssert(
    conversationCall?.callMode === CallMode.Group,
    'canCollapseForCallSet: Call was expected to be a group call'
  );

  const conversationCallId =
    conversationCall?.peekInfo?.eraId != null &&
    options.getCallIdFromEra(conversationCall.peekInfo.eraId);

  if (callHistory.mode === CallMode.Group && callId === conversationCallId) {
    return false;
  }

  return true;
}

export function mapItemsIntoCollapseSets({
  activeCall,
  allowMultidaySets,
  callHistorySelector,
  callSelector,
  getCallIdFromEra,
  items,
  messages,
  midnightToday,
  oldestUnseenIndex,
  scrollToIndex,
}: {
  activeCall: CallStateType | undefined;
  allowMultidaySets: boolean;
  callHistorySelector: CallHistorySelectorType;
  callSelector: CallSelectorType;
  getCallIdFromEra: (eraId: string) => string;
  items: ReadonlyArray<string>;
  messages: MessageLookupType;
  midnightToday: number;
  oldestUnseenIndex: number | null;
  scrollToIndex: number | null;
}): {
  resultSets: Array<CollapseSet>;
  resultUnseenIndex: number | null;
  resultScrollToIndex: number | null;
} {
  const resultSets: Array<CollapseSet> = [];
  let resultUnseenIndex = oldestUnseenIndex;
  let resultScrollToIndex = scrollToIndex;

  // Everything in the current day is the current collapseSet type other than 'none'
  let haveCompleteDay = true;
  // Yesterday the entire day was captured by lastCollapseSet
  let havePreviousCompleteDay = false;
  let currentDayFirstId: string | undefined;

  const max = items.length;

  for (let i = 0; i < max; i += 1) {
    const previousId = items[i - 1];
    const lastCollapseSet = last(resultSets);

    const currentId = items[i];
    strictAssert(currentId, 'no item at index i');
    if (!currentDayFirstId) {
      currentDayFirstId = currentId;
    }

    const currentMessage = messages[currentId];
    const previousMessage = previousId ? messages[previousId] : undefined;

    const changeLength = currentMessage?.groupV2Change?.details.length;
    const extraItems =
      changeLength && changeLength > 1 ? changeLength - 1 : undefined;

    const DEFAULT_SET: CollapseSet =
      currentMessage &&
      canCollapseForGroupSet(currentMessage) &&
      extraItems &&
      extraItems > 0
        ? {
            // A group-v2-change message with more than one inner change detail can be
            // a set all by itself!
            type: 'group-updates',
            id: currentId,
            messages: [
              {
                id: currentId,
                isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
                extraItems,
              },
            ],
          }
        : {
            type: 'none' as const,
            id: currentId,
            messages: undefined,
          };

    // These values need to be translated to the world of collapseSets
    // Note: these values will need to be updated if, in the loop iteration these are
    // set, something other than a push happens below. These both expect the length
    // of resultSets to go up by one.
    if (i === scrollToIndex) {
      resultScrollToIndex = resultSets.length;
    }
    if (i === oldestUnseenIndex) {
      resultUnseenIndex = resultSets.length;
    }

    // Start a new set if we just started looping, or couldn't find target messages
    if (!currentMessage || !previousId || !previousMessage) {
      resultSets.push(DEFAULT_SET);
      continue;
    }

    const currentDay = getMidnight(
      currentMessage.received_at_ms || currentMessage.timestamp
    );
    const previousDay = getMidnight(
      previousMessage.received_at_ms || previousMessage.timestamp
    );
    const atDateBoundary = currentDay !== previousDay;
    const isToday = currentDay === midnightToday;
    if (atDateBoundary) {
      havePreviousCompleteDay = haveCompleteDay;
      haveCompleteDay = true;
      currentDayFirstId = currentId;
    }

    // Start a new set if we just crossed the last seen indicator
    if (i === oldestUnseenIndex) {
      haveCompleteDay &&= atDateBoundary;

      if (allowMultidaySets) {
        // If we've just terminated a multiday set, we need to split it; everything from
        // the current day needs to be in its own set.
        const didSplit = maybeSplitLastCollapseSet({
          atDateBoundary,
          currentDayFirstId,
          haveCompleteDay,
          havePreviousCompleteDay,
          lastCollapseSet,
          messages,
          resultSets,
        });

        if (didSplit) {
          if (i === scrollToIndex) {
            resultScrollToIndex = resultSets.length;
          }
          if (i === oldestUnseenIndex) {
            resultUnseenIndex = resultSets.length;
          }
        }
      }

      resultSets.push(DEFAULT_SET);
      continue;
    }

    strictAssert(
      lastCollapseSet,
      'collapseSets: expect lastCollapseSet to be defined'
    );

    const canContinueSet =
      (lastCollapseSet.type === 'none' ||
        lastCollapseSet.messages.length < MAX_COLLAPSE_SET_SIZE) &&
      (!atDateBoundary ||
        (allowMultidaySets && !isToday && havePreviousCompleteDay));

    // Add to current set if previous and current messages are both group updates
    if (
      canContinueSet &&
      canCollapseForGroupSet(currentMessage) &&
      canCollapseForGroupSet(previousMessage)
    ) {
      strictAssert(
        lastCollapseSet.type !== 'timer-changes' &&
          lastCollapseSet.type !== 'call-events',
        'Should never have two matching group items, but be in a timer or call set'
      );

      if (lastCollapseSet.type === 'group-updates') {
        lastCollapseSet.messages.push({
          id: currentId,
          isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
          extraItems,
          atDateBoundary,
        });
      } else if (lastCollapseSet.type === 'none') {
        resultSets.pop();
        resultSets.push({
          type: 'group-updates',
          id: previousId,
          messages: [
            {
              id: previousId,
              isUnseen: previousMessage.seenStatus === SeenStatus.Unseen,
              extraItems: undefined,
            },
            {
              id: currentId,
              isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
              extraItems,
              atDateBoundary,
            },
          ],
        });
      } else {
        throw missingCaseError(lastCollapseSet);
      }

      if (i === scrollToIndex) {
        resultScrollToIndex = resultSets.length - 1;
      }
      if (i === oldestUnseenIndex) {
        resultUnseenIndex = resultSets.length - 1;
      }

      continue;
    }

    // Add to current set if previous and current messages are both timer updates
    if (
      canContinueSet &&
      canCollapseForTimerSet(currentMessage) &&
      canCollapseForTimerSet(previousMessage)
    ) {
      strictAssert(
        lastCollapseSet.type !== 'group-updates' &&
          lastCollapseSet.type !== 'call-events',
        'Should never have two matching timer items, but be in a group or call set'
      );

      if (lastCollapseSet.type === 'timer-changes') {
        lastCollapseSet.messages.push({
          id: currentId,
          isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
          atDateBoundary,
        });
        lastCollapseSet.endingState =
          currentMessage.expirationTimerUpdate?.expireTimer;
      } else if (lastCollapseSet.type === 'none') {
        resultSets.pop();
        resultSets.push({
          type: 'timer-changes',
          id: previousId,
          endingState: currentMessage.expirationTimerUpdate?.expireTimer,
          messages: [
            {
              id: previousId,
              isUnseen: previousMessage.seenStatus === SeenStatus.Unseen,
            },
            {
              id: currentId,
              isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
              atDateBoundary,
            },
          ],
        });
      } else {
        throw missingCaseError(lastCollapseSet);
      }

      if (i === scrollToIndex) {
        resultScrollToIndex = resultSets.length - 1;
      }
      if (i === oldestUnseenIndex) {
        resultUnseenIndex = resultSets.length - 1;
      }

      continue;
    }

    // Add to current set if previous and current messages are both call events
    if (
      canContinueSet &&
      canCollapseForCallSet(currentMessage, {
        activeCall,
        callHistorySelector,
        callSelector,
        getCallIdFromEra,
      }) &&
      canCollapseForCallSet(previousMessage, {
        activeCall,
        callHistorySelector,
        callSelector,
        getCallIdFromEra,
      })
    ) {
      strictAssert(
        lastCollapseSet.type !== 'group-updates' &&
          lastCollapseSet.type !== 'timer-changes',
        'Should never have two matching call items, but be in a group or timer set'
      );

      if (lastCollapseSet.type === 'call-events') {
        lastCollapseSet.messages.push({
          id: currentId,
          isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
          atDateBoundary,
        });
      } else if (lastCollapseSet.type === 'none') {
        resultSets.pop();
        resultSets.push({
          type: 'call-events',
          id: previousId,
          messages: [
            {
              id: previousId,
              isUnseen: previousMessage.seenStatus === SeenStatus.Unseen,
            },
            {
              id: currentId,
              isUnseen: currentMessage.seenStatus === SeenStatus.Unseen,
              atDateBoundary,
            },
          ],
        });
      } else {
        throw missingCaseError(lastCollapseSet);
      }

      if (i === scrollToIndex) {
        resultScrollToIndex = resultSets.length - 1;
      }
      if (i === oldestUnseenIndex) {
        resultUnseenIndex = resultSets.length - 1;
      }

      continue;
    }

    haveCompleteDay &&= atDateBoundary;

    if (allowMultidaySets) {
      // If we've just terminated a multiday set, we need to split it; everything from
      // the current day needs to be in its own set.
      const didSplit = maybeSplitLastCollapseSet({
        atDateBoundary,
        currentDayFirstId,
        haveCompleteDay,
        havePreviousCompleteDay,
        lastCollapseSet,
        messages,
        resultSets,
      });

      if (didSplit) {
        if (i === scrollToIndex) {
          resultScrollToIndex = resultSets.length;
        }
        if (i === oldestUnseenIndex) {
          resultUnseenIndex = resultSets.length;
        }
      }
    }

    // Finally, just add a new empty set if no situations above triggered
    resultSets.push(DEFAULT_SET);
  }
  return { resultSets, resultUnseenIndex, resultScrollToIndex };
}

// In the case where an existing multiday set extends into the current day, and we then
// discover that the set is ending in the middle of the current day, we need to split
// lastCollapseSet into everything before today, and everything from today.
function maybeSplitLastCollapseSet({
  atDateBoundary,
  currentDayFirstId,
  haveCompleteDay,
  havePreviousCompleteDay,
  lastCollapseSet,
  messages,
  resultSets,
}: {
  atDateBoundary: boolean;
  currentDayFirstId: string | undefined;
  haveCompleteDay: boolean;
  havePreviousCompleteDay: boolean;
  lastCollapseSet: CollapseSet | undefined;
  messages: MessageLookupType;
  resultSets: Array<CollapseSet>;
}): boolean {
  if (!lastCollapseSet) {
    return false;
  }

  if (lastCollapseSet.type === 'none') {
    return false;
  }

  if (atDateBoundary) {
    return false;
  }

  if (haveCompleteDay || !havePreviousCompleteDay) {
    return false;
  }

  const currentDayStartingIndex = lastCollapseSet.messages.findIndex(
    message => message.id === currentDayFirstId
  );
  if (currentDayStartingIndex < 1) {
    return false;
  }

  const previousDayMessages = lastCollapseSet.messages.slice(
    0,
    currentDayStartingIndex
  );
  const currentDayMessages = lastCollapseSet.messages.slice(
    currentDayStartingIndex
  );

  const firstPreviousMessage = previousDayMessages[0];
  strictAssert(
    firstPreviousMessage,
    'No message in previousDayMessages at index 0'
  );
  if (
    previousDayMessages.length > 1 ||
    (firstPreviousMessage.extraItems ?? 0) > 0
  ) {
    // eslint-disable-next-line no-param-reassign
    lastCollapseSet.messages = previousDayMessages;

    if (lastCollapseSet.type === 'timer-changes') {
      const lastMessage = last(lastCollapseSet.messages);
      strictAssert(
        lastMessage,
        'We know lastMessage exists; we previously looked it up'
      );
      // eslint-disable-next-line no-param-reassign
      lastCollapseSet.endingState =
        messages[lastMessage.id]?.expirationTimerUpdate?.expireTimer;
    }
  } else {
    resultSets.pop();
    resultSets.push({
      type: 'none',
      id: firstPreviousMessage.id,
      messages: undefined,
    });
  }

  const firstCurrentMessage = currentDayMessages[0];
  strictAssert(
    firstCurrentMessage,
    'No message in currentDayMessages at index 0'
  );
  if (
    currentDayMessages.length > 1 ||
    (firstCurrentMessage.extraItems ?? 0) > 0
  ) {
    firstCurrentMessage.atDateBoundary = false;
    const currentDaySet: CollapseSet = {
      ...lastCollapseSet,
      id: firstCurrentMessage.id,
      messages: currentDayMessages,
    };
    if (currentDaySet.type === 'timer-changes') {
      const lastMessage = last(currentDayMessages);
      strictAssert(
        lastMessage,
        'We know lastMessage exists; we previously looked it up'
      );
      currentDaySet.endingState =
        messages[lastMessage.id]?.expirationTimerUpdate?.expireTimer;
    }
    resultSets.push(currentDaySet);
  } else {
    resultSets.push({
      type: 'none',
      id: firstCurrentMessage.id,
      messages: undefined,
    });
  }

  return true;
}
