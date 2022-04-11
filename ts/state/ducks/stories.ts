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
import dataInterface from '../../sql/Client';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { ToastReactionFailed } from '../../components/ToastReactionFailed';
import { UUID } from '../../types/UUID';
import { enqueueReactionForSend } from '../../reactions/enqueueReactionForSend';
import { getMessageById } from '../../messages/getMessageById';
import { markViewed } from '../../services/MessageUpdater';
import { queueAttachmentDownloads } from '../../util/queueAttachmentDownloads';
import { replaceIndex } from '../../util/replaceIndex';
import { showToast } from '../../util/showToast';
import { isDownloaded, isDownloading } from '../../types/Attachment';
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

const MARK_STORY_READ = 'stories/MARK_STORY_READ';
const REACT_TO_STORY = 'stories/REACT_TO_STORY';
const STORY_CHANGED = 'stories/STORY_CHANGED';
const TOGGLE_VIEW = 'stories/TOGGLE_VIEW';

type MarkStoryReadActionType = {
  type: typeof MARK_STORY_READ;
  payload: string;
};

type ReactToStoryActionType = {
  type: typeof REACT_TO_STORY;
  payload: {
    messageId: string;
    selectedReaction: string;
  };
};

type StoryChangedActionType = {
  type: typeof STORY_CHANGED;
  payload: StoryDataType;
};

type ToggleViewActionType = {
  type: typeof TOGGLE_VIEW;
};

export type StoriesActionType =
  | MarkStoryReadActionType
  | MessageDeletedActionType
  | ReactToStoryActionType
  | StoryChangedActionType
  | ToggleViewActionType;

// Action Creators

export const actions = {
  markStoryRead,
  queueStoryDownload,
  reactToStory,
  replyToStory,
  storyChanged,
  toggleStoriesView,
};

export const useStoriesActions = (): typeof actions => useBoundActions(actions);

function markStoryRead(
  messageId: string
): ThunkAction<void, RootStateType, unknown, MarkStoryReadActionType> {
  return async (dispatch, getState) => {
    const { stories } = getState().stories;

    const matchingStory = stories.find(story => story.messageId === messageId);

    if (!matchingStory) {
      log.warn(`markStoryRead: no matching story found: ${messageId}`);
      return;
    }

    if (!isDownloaded(matchingStory.attachment)) {
      return;
    }

    if (matchingStory.readStatus !== ReadStatus.Unread) {
      return;
    }

    const message = await getMessageById(messageId);

    if (!message) {
      return;
    }

    const storyReadDate = Date.now();

    markViewed(message.attributes, storyReadDate);

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

    await dataInterface.addNewStoryRead({
      authorId: message.attributes.sourceUuid,
      conversationId: message.attributes.conversationId,
      storyId: new UUID(messageId).toString(),
      storyReadDate,
    });

    dispatch({
      type: MARK_STORY_READ,
      payload: messageId,
    });
  };
}

function queueStoryDownload(
  storyId: string
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return async dispatch => {
    const story = await getMessageById(storyId);

    if (!story) {
      return;
    }

    const storyAttributes: MessageAttributesType = story.attributes;
    const { attachments } = storyAttributes;
    const attachment = attachments && attachments[0];

    if (!attachment) {
      log.warn('queueStoryDownload: No attachment found for story', {
        storyId,
      });
      return;
    }

    if (isDownloaded(attachment)) {
      return;
    }

    if (isDownloading(attachment)) {
      return;
    }

    // We want to ensure that we re-hydrate the story reply context with the
    // completed attachment download.
    story.set({ storyReplyContext: undefined });

    await queueAttachmentDownloads(story.attributes);

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
  messageBody: string,
  mentions: Array<BodyRangeType>,
  timestamp: number,
  story: StoryViewType
): NoopActionType {
  const conversation = window.ConversationController.get(conversationId);

  if (conversation) {
    conversation.enqueueMessageForSend(
      {
        body: messageBody,
        attachments: [],
        mentions,
      },
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

function storyChanged(story: StoryDataType): StoryChangedActionType {
  return {
    type: STORY_CHANGED,
    payload: story,
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

  if (action.type === STORY_CHANGED) {
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

    // Stories don't really need to change except for when we don't have the
    // attachment downloaded and we queue a download. Then the story's message
    // will have the new attachment information. This is an optimization so
    // we don't needlessly re-render.
    const prevStory = state.stories.find(
      existingStory => existingStory.messageId === newStory.messageId
    );
    if (prevStory) {
      const shouldReplace =
        (!isDownloaded(prevStory.attachment) &&
          isDownloaded(newStory.attachment)) ||
        isDownloading(newStory.attachment);

      if (!shouldReplace) {
        return state;
      }

      const storyIndex = state.stories.findIndex(
        existingStory => existingStory.messageId === newStory.messageId
      );

      return {
        ...state,
        stories: replaceIndex(state.stories, storyIndex, newStory),
      };
    }

    const stories = [...state.stories, newStory].sort((a, b) =>
      a.timestamp > b.timestamp ? 1 : -1
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

  if (action.type === MARK_STORY_READ) {
    return {
      ...state,
      stories: state.stories.map(story => {
        if (story.messageId === action.payload) {
          return {
            ...story,
            readStatus: ReadStatus.Viewed,
          };
        }

        return story;
      }),
    };
  }

  return state;
}
