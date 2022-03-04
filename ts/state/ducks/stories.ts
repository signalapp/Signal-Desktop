// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import { pick } from 'lodash';
import type { AttachmentType } from '../../types/Attachment';
import type { BodyRangeType } from '../../types/Util';
import type { MessageAttributesType } from '../../model-types.d';
import type { MessageDeletedActionType } from './conversations';
import type { NoopActionType } from './noop';
import type { StateType as RootStateType } from '../reducer';
import type { StoryViewType } from '../../components/StoryListItem';
import type { SyncType } from '../../jobs/helpers/syncHelpers';
import * as log from '../../logging/log';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { ToastReactionFailed } from '../../components/ToastReactionFailed';
import { enqueueReactionForSend } from '../../reactions/enqueueReactionForSend';
import { getMessageById } from '../../messages/getMessageById';
import { markViewed } from '../../services/MessageUpdater';
import { showToast } from '../../util/showToast';
import { useBoundActions } from '../../hooks/useBoundActions';
import { viewSyncJobQueue } from '../../jobs/viewSyncJobQueue';
import { viewedReceiptsJobQueue } from '../../jobs/viewedReceiptsJobQueue';

export type StoryDataType = {
  attachment?: AttachmentType;
  messageId: string;
  selectedReaction?: string;
} & Pick<
  MessageAttributesType,
  'conversationId' | 'readStatus' | 'source' | 'sourceUuid' | 'timestamp'
>;

// State

export type StoriesStateType = {
  readonly isShowingStoriesView: boolean;
  readonly stories: Array<StoryDataType>;
};

// Actions

const ADD_STORY = 'stories/ADD_STORY';
const REACT_TO_STORY = 'stories/REACT_TO_STORY';
const TOGGLE_VIEW = 'stories/TOGGLE_VIEW';

type AddStoryActionType = {
  type: typeof ADD_STORY;
  payload: StoryDataType;
};

type ReactToStoryActionType = {
  type: typeof REACT_TO_STORY;
  payload: {
    messageId: string;
    selectedReaction: string;
  };
};

type ToggleViewActionType = {
  type: typeof TOGGLE_VIEW;
};

export type StoriesActionType =
  | AddStoryActionType
  | MessageDeletedActionType
  | ReactToStoryActionType
  | ToggleViewActionType;

// Action Creators

export const actions = {
  addStory,
  markStoryRead,
  reactToStory,
  replyToStory,
  toggleStoriesView,
};

export const useStoriesActions = (): typeof actions => useBoundActions(actions);

function addStory(story: StoryDataType): AddStoryActionType {
  return {
    type: ADD_STORY,
    payload: story,
  };
}

function markStoryRead(
  messageId: string
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return async (dispatch, getState) => {
    const { stories } = getState().stories;

    const matchingStory = stories.find(story => story.messageId === messageId);

    if (!matchingStory) {
      log.warn(`markStoryRead: no matching story found: ${messageId}`);
      return;
    }

    if (matchingStory.readStatus !== ReadStatus.Unread) {
      return;
    }

    const message = await getMessageById(messageId);

    if (!message) {
      return;
    }

    markViewed(message.attributes, Date.now());

    const viewedReceipt = {
      messageId,
      senderE164: message.attributes.source,
      senderUuid: message.attributes.sourceUuid,
      timestamp: message.attributes.sent_at,
    };
    const viewSyncs: Array<SyncType> = [viewedReceipt];

    if (!window.ConversationController.areWePrimaryDevice()) {
      viewSyncJobQueue.add({ viewSyncs });
    }

    viewedReceiptsJobQueue.add({ viewedReceipt });

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function reactToStory(
  nextReaction: string,
  messageId: string,
  previousReaction?: string
): ThunkAction<void, RootStateType, unknown, ReactToStoryActionType> {
  return async dispatch => {
    try {
      await enqueueReactionForSend({
        messageId,
        emoji: nextReaction,
        remove: nextReaction === previousReaction,
      });
      dispatch({
        type: REACT_TO_STORY,
        payload: {
          messageId,
          selectedReaction: nextReaction,
        },
      });
    } catch (error) {
      log.error('Error enqueuing reaction', error, messageId, nextReaction);
      showToast(ToastReactionFailed);
    }
  };
}

function replyToStory(
  conversationId: string,
  message: string,
  mentions: Array<BodyRangeType>,
  timestamp: number,
  story: StoryViewType
): NoopActionType {
  const conversation = window.ConversationController.get(conversationId);

  if (conversation) {
    conversation.enqueueMessageForSend(
      message,
      [],
      undefined,
      undefined,
      undefined,
      mentions,
      {
        storyId: story.messageId,
        timestamp,
      }
    );
  }

  return {
    type: 'NOOP',
    payload: null,
  };
}

function toggleStoriesView(): ToggleViewActionType {
  return {
    type: TOGGLE_VIEW,
  };
}

// Reducer

export function getEmptyState(
  overrideState: Partial<StoriesStateType> = {}
): StoriesStateType {
  return {
    isShowingStoriesView: false,
    stories: [],
    ...overrideState,
  };
}

export function reducer(
  state: Readonly<StoriesStateType> = getEmptyState(),
  action: Readonly<StoriesActionType>
): StoriesStateType {
  if (action.type === TOGGLE_VIEW) {
    return {
      ...state,
      isShowingStoriesView: !state.isShowingStoriesView,
    };
  }

  if (action.type === 'MESSAGE_DELETED') {
    return {
      ...state,
      stories: state.stories.filter(
        story => story.messageId !== action.payload.id
      ),
    };
  }

  if (action.type === ADD_STORY) {
    const newStory = pick(action.payload, [
      'attachment',
      'conversationId',
      'messageId',
      'readStatus',
      'selectedReaction',
      'source',
      'sourceUuid',
      'timestamp',
    ]);

    // TODO DEKTOP-3179
    // ADD_STORY fires whenever the message model changes so we check if this
    // story already exists in state -- if it does then we don't need to re-add.
    const hasStory = state.stories.find(
      existingStory => existingStory.messageId === newStory.messageId
    );
    if (hasStory) {
      return state;
    }

    const stories = [newStory, ...state.stories].sort((a, b) =>
      a.timestamp > b.timestamp ? -1 : 1
    );

    return {
      ...state,
      stories,
    };
  }

  if (action.type === REACT_TO_STORY) {
    return {
      ...state,
      stories: state.stories.map(story => {
        if (story.messageId === action.payload.messageId) {
          return {
            ...story,
            selectedReaction: action.payload.selectedReaction,
          };
        }

        return story;
      }),
    };
  }

  return state;
}
