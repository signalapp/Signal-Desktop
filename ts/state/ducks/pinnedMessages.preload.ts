// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import type { PinnedMessageRenderData } from '../../types/PinnedMessage.std.js';
import type { ReadonlyMessageAttributesType } from '../../model-types.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { isIncoming } from '../selectors/message.preload.js';
import { isAciString } from '../../util/isAciString.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import type { StateThunk } from '../types.std.js';
import type { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../../jobs/conversationJobQueue.preload.js';
import { getPinnedMessagesLimit } from '../../util/pinnedMessages.dom.js';
import { getPinnedMessageExpiresAt } from '../../util/pinnedMessages.std.js';
import { getSelectedConversationId } from '../selectors/conversations.dom.js';
import type {
  AddPreloadDataActionType,
  ConsumePreloadDataActionType,
  ConversationUnloadedActionType,
  MessageChangedActionType,
  MessagesResetActionType,
  TargetedConversationChangedActionType,
} from './conversations.preload.js';
import {
  ADD_PRELOAD_DATA,
  CONSUME_PRELOAD_DATA,
  CONVERSATION_UNLOADED,
  MESSAGE_CHANGED,
  TARGETED_CONVERSATION_CHANGED,
} from './conversations.preload.js';

type PreloadData = ReadonlyDeep<{
  conversationId: string;
  pinnedMessages: ReadonlyArray<PinnedMessageRenderData>;
}>;

export type PinnedMessagesState = ReadonlyDeep<{
  preloadData: PreloadData | null;
  conversationId: string | null;
  pinnedMessages: ReadonlyArray<PinnedMessageRenderData> | null;
}>;

const PINNED_MESSAGES_REPLACE = 'pinnedMessages/PINNED_MESSAGES_REPLACE';

export type PinnedMessagesReplace = ReadonlyDeep<{
  type: typeof PINNED_MESSAGES_REPLACE;
  payload: {
    conversationId: string;
    pinnedMessages: ReadonlyArray<PinnedMessageRenderData>;
  };
}>;

export type PinnedMessagesAction = ReadonlyDeep<PinnedMessagesReplace>;

export function getEmptyState(): PinnedMessagesState {
  return {
    preloadData: null,
    conversationId: null,
    pinnedMessages: null,
  };
}

function getMessageAuthorAci(
  message: ReadonlyMessageAttributesType
): AciString {
  if (isIncoming(message)) {
    strictAssert(
      isAciString(message.sourceServiceId),
      'Message sourceServiceId must be an ACI'
    );
    return message.sourceServiceId;
  }
  return itemStorage.user.getCheckedAci();
}

type PinnedMessageTarget = ReadonlyDeep<{
  conversationId: string;
  targetMessageId: string;
  targetAuthorAci: AciString;
  targetSentTimestamp: number;
}>;

async function getPinnedMessageTarget(
  targetMessageId: string
): Promise<PinnedMessageTarget> {
  const message = await DataReader.getMessageById(targetMessageId);
  if (message == null) {
    throw new Error('getPinnedMessageTarget: Target message not found');
  }
  return {
    conversationId: message.conversationId,
    targetMessageId: message.id,
    targetAuthorAci: getMessageAuthorAci(message),
    targetSentTimestamp: message.sent_at,
  };
}

function onPinnedMessagesChanged(
  conversationId: string
): StateThunk<PinnedMessagesReplace> {
  return async (dispatch, getState) => {
    const selectedConversationId = getSelectedConversationId(getState());
    if (
      selectedConversationId == null ||
      selectedConversationId !== conversationId
    ) {
      return;
    }

    const pinnedMessages =
      await DataReader.getPinnedMessagesForConversation(conversationId);

    dispatch({
      type: PINNED_MESSAGES_REPLACE,
      payload: {
        conversationId,
        pinnedMessages,
      },
    });
  };
}

function onPinnedMessageAdd(
  targetMessageId: string,
  pinDurationSeconds: DurationInSeconds | null
): StateThunk {
  return async dispatch => {
    const target = await getPinnedMessageTarget(targetMessageId);
    const targetConversation = window.ConversationController.get(
      target.conversationId
    );
    strictAssert(targetConversation != null, 'Missing target conversation');

    await conversationJobQueue.add({
      type: conversationQueueJobEnum.enum.PinMessage,
      ...target,
      pinDurationSeconds,
    });

    const pinnedMessagesLimit = getPinnedMessagesLimit();

    const pinnedAt = Date.now();
    const expiresAt = getPinnedMessageExpiresAt(pinnedAt, pinDurationSeconds);

    await DataWriter.appendPinnedMessage(pinnedMessagesLimit, {
      conversationId: target.conversationId,
      messageId: target.targetMessageId,
      expiresAt,
      pinnedAt,
    });

    await targetConversation.addNotification('pinned-message-notification', {
      pinnedMessageId: targetMessageId,
      sourceServiceId: itemStorage.user.getCheckedAci(),
    });

    dispatch(onPinnedMessagesChanged(target.conversationId));
  };
}

function onPinnedMessageRemove(targetMessageId: string): StateThunk {
  return async dispatch => {
    const target = await getPinnedMessageTarget(targetMessageId);
    await conversationJobQueue.add({
      type: conversationQueueJobEnum.enum.UnpinMessage,
      ...target,
    });
    await DataWriter.deletePinnedMessageByMessageId(targetMessageId);

    dispatch(onPinnedMessagesChanged(target.conversationId));
  };
}

export const actions = {
  onPinnedMessagesChanged,
  onPinnedMessageAdd,
  onPinnedMessageRemove,
};

export const usePinnedMessagesActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function updateMessageInPinnedMessages(
  pinnedMessages: ReadonlyArray<PinnedMessageRenderData>,
  message: ReadonlyMessageAttributesType
): ReadonlyArray<PinnedMessageRenderData> {
  return pinnedMessages.map(pinnedMessage => {
    if (pinnedMessage.message.id === message.id) {
      return { ...pinnedMessage, message };
    }
    return pinnedMessage;
  });
}

export function reducer(
  state: PinnedMessagesState = getEmptyState(),
  action:
    | PinnedMessagesAction
    | MessageChangedActionType
    | TargetedConversationChangedActionType
    | ConversationUnloadedActionType
    | AddPreloadDataActionType
    | ConsumePreloadDataActionType
    | MessagesResetActionType
): PinnedMessagesState {
  switch (action.type) {
    case PINNED_MESSAGES_REPLACE:
      if (state.conversationId !== action.payload.conversationId) {
        return state;
      }

      return {
        ...state,
        pinnedMessages: action.payload.pinnedMessages,
      };
    case TARGETED_CONVERSATION_CHANGED: {
      const conversationId = action.payload.conversationId ?? null;
      return {
        ...state,
        preloadData:
          conversationId != null &&
          state.preloadData != null &&
          state.preloadData.conversationId === conversationId
            ? state.preloadData
            : null,
        conversationId,
        pinnedMessages: null,
      };
    }
    case CONVERSATION_UNLOADED:
      if (state.conversationId !== action.payload.conversationId) {
        return state;
      }
      return {
        ...state,
        conversationId: null,
        pinnedMessages: null,
      };
    case ADD_PRELOAD_DATA:
      return {
        ...state,
        preloadData: {
          conversationId: action.payload.conversationId,
          pinnedMessages: action.payload.pinnedMessages,
        },
      };
    case CONSUME_PRELOAD_DATA:
      if (state.preloadData == null) {
        return state;
      }
      if (state.preloadData.conversationId === action.payload.conversationId) {
        return {
          ...state,
          preloadData: null,
          conversationId: state.preloadData.conversationId,
          pinnedMessages: state.preloadData.pinnedMessages,
        };
      }
      return {
        ...state,
        preloadData: null,
      };
    case MESSAGE_CHANGED: {
      let nextState = state;

      if (
        nextState.conversationId === action.payload.conversationId &&
        nextState.pinnedMessages != null
      ) {
        nextState = {
          ...nextState,
          pinnedMessages: updateMessageInPinnedMessages(
            nextState.pinnedMessages,
            action.payload.data
          ),
        };
      }

      if (
        nextState.preloadData != null &&
        nextState.preloadData.conversationId === action.payload.id
      ) {
        nextState = {
          ...nextState,
          preloadData: {
            ...nextState.preloadData,
            pinnedMessages: updateMessageInPinnedMessages(
              nextState.preloadData.pinnedMessages,
              action.payload.data
            ),
          },
        };
      }

      return nextState;
    }
    default:
      return state;
  }
}
