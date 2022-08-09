// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { isEqual, noop, pick } from 'lodash';
import type { AttachmentType } from '../../types/Attachment';
import type { BodyRangeType } from '../../types/Util';
import type { MessageAttributesType } from '../../model-types.d';
import type {
  MessageChangedActionType,
  MessageDeletedActionType,
  MessagesAddedActionType,
} from './conversations';
import type { NoopActionType } from './noop';
import type { StateType as RootStateType } from '../reducer';
import type { StoryViewType } from '../../types/Stories';
import type { SyncType } from '../../jobs/helpers/syncHelpers';
import type { UUIDStringType } from '../../types/UUID';
import * as log from '../../logging/log';
import dataInterface from '../../sql/Client';
import { DAY } from '../../util/durations';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { StoryViewDirectionType, StoryViewModeType } from '../../types/Stories';
import { StoryRecipientUpdateEvent } from '../../textsecure/messageReceiverEvents';
import { ToastReactionFailed } from '../../components/ToastReactionFailed';
import { enqueueReactionForSend } from '../../reactions/enqueueReactionForSend';
import { getMessageById } from '../../messages/getMessageById';
import { markViewed } from '../../services/MessageUpdater';
import { queueAttachmentDownloads } from '../../util/queueAttachmentDownloads';
import { replaceIndex } from '../../util/replaceIndex';
import { sendDeleteForEveryoneMessage } from '../../util/sendDeleteForEveryoneMessage';
import { showToast } from '../../util/showToast';
import {
  hasFailed,
  hasNotResolved,
  isDownloaded,
  isDownloading,
} from '../../types/Attachment';
import { getConversationSelector } from '../selectors/conversations';
import { getSendOptions } from '../../util/getSendOptions';
import { getStories } from '../selectors/stories';
import { getStoryDataFromMessageAttributes } from '../../services/storyLoader';
import { isGroup } from '../../util/whatTypeOfConversation';
import { isNotNil } from '../../util/isNotNil';
import { isStory } from '../../messages/helpers';
import { onStoryRecipientUpdate } from '../../util/onStoryRecipientUpdate';
import { sendStoryMessage as doSendStoryMessage } from '../../util/sendStoryMessage';
import { useBoundActions } from '../../hooks/useBoundActions';
import { viewSyncJobQueue } from '../../jobs/viewSyncJobQueue';
import { viewedReceiptsJobQueue } from '../../jobs/viewedReceiptsJobQueue';

export type StoryDataType = {
  attachment?: AttachmentType;
  messageId: string;
} & Pick<
  MessageAttributesType,
  | 'canReplyToStory'
  | 'conversationId'
  | 'deletedForEveryone'
  | 'reactions'
  | 'readStatus'
  | 'sendStateByConversationId'
  | 'source'
  | 'sourceUuid'
  | 'storyDistributionListId'
  | 'timestamp'
  | 'type'
>;

export type SelectedStoryDataType = {
  currentIndex: number;
  messageId: string;
  numStories: number;
  shouldShowDetailsModal: boolean;
};

// State

export type StoriesStateType = {
  readonly isShowingStoriesView: boolean;
  readonly replyState?: {
    messageId: string;
    replies: Array<MessageAttributesType>;
  };
  readonly selectedStoryData?: SelectedStoryDataType;
  readonly stories: Array<StoryDataType>;
  readonly storyViewMode?: StoryViewModeType;
};

// Actions

const DOE_STORY = 'stories/DOE';
const LOAD_STORY_REPLIES = 'stories/LOAD_STORY_REPLIES';
const MARK_STORY_READ = 'stories/MARK_STORY_READ';
const REPLY_TO_STORY = 'stories/REPLY_TO_STORY';
export const RESOLVE_ATTACHMENT_URL = 'stories/RESOLVE_ATTACHMENT_URL';
const STORY_CHANGED = 'stories/STORY_CHANGED';
const TOGGLE_VIEW = 'stories/TOGGLE_VIEW';
const VIEW_STORY = 'stories/VIEW_STORY';

type DOEStoryActionType = {
  type: typeof DOE_STORY;
  payload: string;
};

type LoadStoryRepliesActionType = {
  type: typeof LOAD_STORY_REPLIES;
  payload: {
    messageId: string;
    replies: Array<MessageAttributesType>;
  };
};

type MarkStoryReadActionType = {
  type: typeof MARK_STORY_READ;
  payload: string;
};

type ReplyToStoryActionType = {
  type: typeof REPLY_TO_STORY;
  payload: MessageAttributesType;
};

type ResolveAttachmentUrlActionType = {
  type: typeof RESOLVE_ATTACHMENT_URL;
  payload: {
    messageId: string;
    attachmentUrl: string;
  };
};

type StoryChangedActionType = {
  type: typeof STORY_CHANGED;
  payload: StoryDataType;
};

type ToggleViewActionType = {
  type: typeof TOGGLE_VIEW;
};

type ViewStoryActionType = {
  type: typeof VIEW_STORY;
  payload:
    | {
        selectedStoryData: SelectedStoryDataType;
        storyViewMode: StoryViewModeType;
      }
    | undefined;
};

export type StoriesActionType =
  | DOEStoryActionType
  | LoadStoryRepliesActionType
  | MarkStoryReadActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessagesAddedActionType
  | ReplyToStoryActionType
  | ResolveAttachmentUrlActionType
  | StoryChangedActionType
  | ToggleViewActionType
  | ViewStoryActionType;

// Action Creators

function deleteStoryForEveryone(
  story: StoryViewType
): ThunkAction<void, RootStateType, unknown, DOEStoryActionType> {
  return async (dispatch, getState) => {
    if (!story.sendState) {
      return;
    }

    const conversationIds = new Set(
      story.sendState.map(({ recipient }) => recipient.id)
    );
    const updatedStoryRecipients = new Map<
      string,
      {
        distributionListIds: Set<string>;
        isAllowedToReply: boolean;
      }
    >();

    const ourConversation =
      window.ConversationController.getOurConversationOrThrow();

    // Remove ourselves from the DOE.
    conversationIds.delete(ourConversation.id);

    // Find stories that were sent to other distribution lists so that we don't
    // send a DOE request to the members of those lists.
    const { stories } = getState().stories;
    stories.forEach(item => {
      const { sendStateByConversationId } = item;
      // We only want matching timestamp stories which are stories that were
      // sent to multi distribution lists.
      // We don't want the story we just passed in.
      // Don't need to check for stories that have already been deleted.
      // And only for sent stories, not incoming.
      if (
        item.timestamp !== story.timestamp ||
        item.messageId === story.messageId ||
        item.deletedForEveryone ||
        !sendStateByConversationId
      ) {
        return;
      }

      Object.keys(sendStateByConversationId).forEach(conversationId => {
        if (conversationId === ourConversation.id) {
          return;
        }

        const destinationUuid =
          window.ConversationController.get(conversationId)?.get('uuid');

        if (!destinationUuid) {
          return;
        }

        const distributionListIds =
          updatedStoryRecipients.get(destinationUuid)?.distributionListIds ||
          new Set();

        // These are the remaining distribution list ids that the user has
        // access to.
        updatedStoryRecipients.set(destinationUuid, {
          distributionListIds: item.storyDistributionListId
            ? new Set([...distributionListIds, item.storyDistributionListId])
            : distributionListIds,
          isAllowedToReply:
            sendStateByConversationId[conversationId]
              .isAllowedToReplyToStory !== false,
        });

        // Remove this conversationId so we don't send the DOE to those that
        // still have access.
        conversationIds.delete(conversationId);
      });
    });

    // Send the DOE
    conversationIds.forEach(cid => {
      // Don't DOE yourself!
      if (cid === ourConversation.id) {
        return;
      }

      const conversation = window.ConversationController.get(cid);

      if (!conversation) {
        return;
      }

      sendDeleteForEveryoneMessage(conversation.attributes, {
        deleteForEveryoneDuration: DAY,
        id: story.messageId,
        timestamp: story.timestamp,
      });
    });

    // If it's the last story sent to a distribution list we don't have to send
    // the sync message, but to be consistent let's build up the updated
    // storyMessageRecipients and send the sync message.
    if (!updatedStoryRecipients.size) {
      story.sendState.forEach(item => {
        if (item.recipient.id === ourConversation.id) {
          return;
        }

        const destinationUuid = window.ConversationController.get(
          item.recipient.id
        )?.get('uuid');

        if (!destinationUuid) {
          return;
        }

        updatedStoryRecipients.set(destinationUuid, {
          distributionListIds: new Set(),
          isAllowedToReply: item.isAllowedToReplyToStory !== false,
        });
      });
    }

    // Send the sync message with the updated storyMessageRecipients list
    const sender = window.textsecure.messaging;
    if (sender) {
      const options = await getSendOptions(ourConversation.attributes, {
        syncMessage: true,
      });

      const storyMessageRecipients: Array<{
        destinationUuid: string;
        distributionListIds: Array<string>;
        isAllowedToReply: boolean;
      }> = [];

      updatedStoryRecipients.forEach((recipientData, destinationUuid) => {
        storyMessageRecipients.push({
          destinationUuid,
          distributionListIds: Array.from(recipientData.distributionListIds),
          isAllowedToReply: recipientData.isAllowedToReply,
        });
      });

      const destinationUuid = ourConversation.get('uuid');

      if (!destinationUuid) {
        return;
      }

      // Sync message for other devices
      sender.sendSyncMessage({
        destination: undefined,
        destinationUuid,
        storyMessageRecipients,
        expirationStartTimestamp: null,
        isUpdate: true,
        options,
        timestamp: story.timestamp,
        urgent: false,
      });

      // Sync message for Desktop
      const ev = new StoryRecipientUpdateEvent(
        {
          destinationUuid,
          timestamp: story.timestamp,
          storyMessageRecipients,
        },
        noop
      );
      onStoryRecipientUpdate(ev);
    }

    dispatch({
      type: DOE_STORY,
      payload: story.messageId,
    });
  };
}

function loadStoryReplies(
  conversationId: string,
  messageId: string
): ThunkAction<void, RootStateType, unknown, LoadStoryRepliesActionType> {
  return async (dispatch, getState) => {
    const conversation = getConversationSelector(getState())(conversationId);
    const replies = await dataInterface.getOlderMessagesByConversation(
      conversationId,
      { limit: 9000, storyId: messageId, isGroup: isGroup(conversation) }
    );

    dispatch({
      type: LOAD_STORY_REPLIES,
      payload: {
        messageId,
        replies,
      },
    });
  };
}

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

    if (
      !isDownloaded(matchingStory.attachment) &&
      !hasFailed(matchingStory.attachment)
    ) {
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
      storyId: messageId,
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
): ThunkAction<
  void,
  RootStateType,
  unknown,
  NoopActionType | ResolveAttachmentUrlActionType
> {
  return async (dispatch, getState) => {
    const { stories } = getState().stories;
    const story = stories.find(item => item.messageId === storyId);

    if (!story) {
      return;
    }

    const { attachment } = story;

    if (!attachment) {
      log.warn('queueStoryDownload: No attachment found for story', {
        storyId,
      });
      return;
    }

    if (hasFailed(attachment)) {
      return;
    }

    if (isDownloaded(attachment)) {
      if (!attachment.path) {
        return;
      }

      // This function also resolves the attachment's URL in case we've already
      // downloaded the attachment but haven't pointed its path to an absolute
      // location on disk.
      if (hasNotResolved(attachment)) {
        dispatch({
          type: RESOLVE_ATTACHMENT_URL,
          payload: {
            messageId: storyId,
            attachmentUrl: window.Signal.Migrations.getAbsoluteAttachmentPath(
              attachment.path
            ),
          },
        });
      }

      return;
    }

    if (isDownloading(attachment)) {
      return;
    }

    const message = await getMessageById(storyId);

    if (message) {
      // We want to ensure that we re-hydrate the story reply context with the
      // completed attachment download.
      message.set({ storyReplyContext: undefined });

      await queueAttachmentDownloads(message.attributes);
    }

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function reactToStory(
  nextReaction: string,
  messageId: string
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return async dispatch => {
    try {
      await enqueueReactionForSend({
        messageId,
        emoji: nextReaction,
        remove: false,
      });
    } catch (error) {
      log.error('Error enqueuing reaction', error, messageId, nextReaction);
      showToast(ToastReactionFailed);
    }

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function replyToStory(
  conversationId: string,
  messageBody: string,
  mentions: Array<BodyRangeType>,
  timestamp: number,
  story: StoryViewType
): ThunkAction<void, RootStateType, unknown, ReplyToStoryActionType> {
  return async dispatch => {
    const conversation = window.ConversationController.get(conversationId);

    if (!conversation) {
      log.error('replyToStory: conversation does not exist', conversationId);
      return;
    }

    const messageAttributes = await conversation.enqueueMessageForSend(
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

    if (messageAttributes) {
      dispatch({
        type: REPLY_TO_STORY,
        payload: messageAttributes,
      });
    }
  };
}

function sendStoryMessage(
  listIds: Array<UUIDStringType>,
  conversationIds: Array<string>,
  attachment: AttachmentType
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return async dispatch => {
    await doSendStoryMessage(listIds, conversationIds, attachment);

    dispatch({
      type: 'NOOP',
      payload: null,
    });
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

const getSelectedStoryDataForConversationId = (
  dispatch: ThunkDispatch<
    RootStateType,
    unknown,
    NoopActionType | ResolveAttachmentUrlActionType
  >,
  getState: () => RootStateType,
  conversationId: string,
  selectedStoryId?: string
): {
  currentIndex: number;
  hasUnread: boolean;
  numStories: number;
  storiesByConversationId: Array<StoryDataType>;
} => {
  const state = getState();
  const { stories } = state.stories;

  const storiesByConversationId = stories.filter(
    item => item.conversationId === conversationId && !item.deletedForEveryone
  );

  // Find the index of the storyId provided, or if none provided then find the
  // oldest unread story from the user. If all stories are read then we can
  // start at the first story.
  let currentIndex = 0;
  let hasUnread = false;
  storiesByConversationId.forEach((item, index) => {
    if (selectedStoryId && item.messageId === selectedStoryId) {
      currentIndex = index;
    }

    if (
      !selectedStoryId &&
      !currentIndex &&
      item.readStatus === ReadStatus.Unread
    ) {
      hasUnread = true;
      currentIndex = index;
    }
  });

  const numStories = storiesByConversationId.length;

  // Queue all undownloaded stories once we're viewing someone's stories
  storiesByConversationId.forEach(item => {
    if (isDownloaded(item.attachment) || isDownloading(item.attachment)) {
      return;
    }

    queueStoryDownload(item.messageId)(dispatch, getState, null);
  });

  return {
    currentIndex,
    hasUnread,
    numStories,
    storiesByConversationId,
  };
};

function viewUserStories(
  conversationId: string,
  shouldShowDetailsModal = false
): ThunkAction<void, RootStateType, unknown, ViewStoryActionType> {
  return (dispatch, getState) => {
    const { currentIndex, hasUnread, numStories, storiesByConversationId } =
      getSelectedStoryDataForConversationId(dispatch, getState, conversationId);

    const story = storiesByConversationId[currentIndex];

    dispatch({
      type: VIEW_STORY,
      payload: {
        selectedStoryData: {
          currentIndex,
          messageId: story.messageId,
          numStories,
          shouldShowDetailsModal,
        },
        storyViewMode: hasUnread
          ? StoryViewModeType.Unread
          : StoryViewModeType.All,
      },
    });
  };
}

export type ViewStoryActionCreatorType = (opts: {
  closeViewer?: boolean;
  storyId?: string;
  storyViewMode?: StoryViewModeType;
  viewDirection?: StoryViewDirectionType;
  shouldShowDetailsModal?: boolean;
}) => unknown;

const viewStory: ViewStoryActionCreatorType = ({
  closeViewer,
  shouldShowDetailsModal = false,
  storyId,
  storyViewMode,
  viewDirection,
}): ThunkAction<void, RootStateType, unknown, ViewStoryActionType> => {
  return (dispatch, getState) => {
    if (closeViewer || !storyId || !storyViewMode) {
      dispatch({
        type: VIEW_STORY,
        payload: undefined,
      });
      return;
    }

    const state = getState();
    const { stories } = state.stories;

    // Spec:
    // When opening the story viewer you should always be taken to the oldest
    //    un viewed story of the user you tapped on
    // If all stories from a user are viewed, opening the viewer should take
    //    you to their oldest story

    const story = stories.find(
      item => item.messageId === storyId && !item.deletedForEveryone
    );

    if (!story) {
      return;
    }

    const { currentIndex, numStories, storiesByConversationId } =
      getSelectedStoryDataForConversationId(
        dispatch,
        getState,
        story.conversationId,
        storyId
      );

    // Go directly to the storyId selected
    if (!viewDirection) {
      dispatch({
        type: VIEW_STORY,
        payload: {
          selectedStoryData: {
            currentIndex,
            messageId: storyId,
            numStories,
            shouldShowDetailsModal,
          },
          storyViewMode,
        },
      });
      return;
    }

    // Next story within the same user's stories
    if (
      viewDirection === StoryViewDirectionType.Next &&
      currentIndex < numStories - 1
    ) {
      const nextIndex = currentIndex + 1;
      const nextStory = storiesByConversationId[nextIndex];

      dispatch({
        type: VIEW_STORY,
        payload: {
          selectedStoryData: {
            currentIndex: nextIndex,
            messageId: nextStory.messageId,
            numStories,
            shouldShowDetailsModal: false,
          },
          storyViewMode,
        },
      });
      return;
    }

    // Prev story within the same user's stories
    if (viewDirection === StoryViewDirectionType.Previous && currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      const nextStory = storiesByConversationId[nextIndex];

      dispatch({
        type: VIEW_STORY,
        payload: {
          selectedStoryData: {
            currentIndex: nextIndex,
            messageId: nextStory.messageId,
            numStories,
            shouldShowDetailsModal: false,
          },
          storyViewMode,
        },
      });
      return;
    }

    // Are there any unviewed stories left? If so we should play the unviewed
    // stories first. But only if we're going "next"
    if (viewDirection === StoryViewDirectionType.Next) {
      const unreadStory = stories.find(
        item =>
          item.readStatus === ReadStatus.Unread && !item.deletedForEveryone
      );
      if (unreadStory) {
        const nextSelectedStoryData = getSelectedStoryDataForConversationId(
          dispatch,
          getState,
          unreadStory.conversationId,
          unreadStory.messageId
        );
        dispatch({
          type: VIEW_STORY,
          payload: {
            selectedStoryData: {
              currentIndex: nextSelectedStoryData.currentIndex,
              messageId: unreadStory.messageId,
              numStories: nextSelectedStoryData.numStories,
              shouldShowDetailsModal: false,
            },
            storyViewMode,
          },
        });
        return;
      }
    }

    const conversationStories = getStories(state).stories;
    const conversationStoryIndex = conversationStories.findIndex(
      item => item.conversationId === story.conversationId
    );

    if (conversationStoryIndex < 0) {
      return;
    }

    // Find the next user's stories
    if (
      viewDirection === StoryViewDirectionType.Next &&
      conversationStoryIndex < conversationStories.length - 1
    ) {
      // Spec:
      // Tapping right advances you to the next un viewed story
      // If all stories are viewed, advance to the next viewed story
      // When you reach the newest story from a user, tapping right again
      //    should take you to the next user's oldest un viewed story or oldest
      //    story if all stories for the next user are viewed.
      // When you reach the newest story from the last user in the story list,
      //    tapping right should close the viewer
      // Touch area for tapping right should be 80% of width of the screen
      const nextConversationStoryIndex = conversationStoryIndex + 1;
      const conversationStory = conversationStories[nextConversationStoryIndex];

      const nextSelectedStoryData = getSelectedStoryDataForConversationId(
        dispatch,
        getState,
        conversationStory.conversationId
      );

      // Close the viewer if we were viewing unread stories only and we've
      // reached the last unread story.
      if (
        !nextSelectedStoryData.hasUnread &&
        storyViewMode === StoryViewModeType.Unread
      ) {
        dispatch({
          type: VIEW_STORY,
          payload: undefined,
        });
        return;
      }

      dispatch({
        type: VIEW_STORY,
        payload: {
          selectedStoryData: {
            currentIndex: 0,
            messageId:
              nextSelectedStoryData.storiesByConversationId[0].messageId,
            numStories: nextSelectedStoryData.numStories,
            shouldShowDetailsModal: false,
          },
          storyViewMode,
        },
      });
      return;
    }

    // Find the previous user's stories
    if (
      viewDirection === StoryViewDirectionType.Previous &&
      conversationStoryIndex > 0
    ) {
      // Spec:
      // Tapping left takes you back to the previous story
      // When you reach the oldest story from a user, tapping left again takes
      //    you to the previous users oldest un viewed story or newest viewed
      //    story if all stories are viewed
      // If you tap left on the oldest story from the first user in the story
      //    list, it should re-start playback on that story
      // Touch area for tapping left should be 20% of width of the screen
      const nextConversationStoryIndex = conversationStoryIndex - 1;
      const conversationStory = conversationStories[nextConversationStoryIndex];

      const nextSelectedStoryData = getSelectedStoryDataForConversationId(
        dispatch,
        getState,
        conversationStory.conversationId
      );

      dispatch({
        type: VIEW_STORY,
        payload: {
          selectedStoryData: {
            currentIndex: 0,
            messageId:
              nextSelectedStoryData.storiesByConversationId[0].messageId,
            numStories: nextSelectedStoryData.numStories,
            shouldShowDetailsModal: false,
          },
          storyViewMode,
        },
      });
      return;
    }

    // Could not meet any criteria, close the viewer
    dispatch({
      type: VIEW_STORY,
      payload: undefined,
    });
  };
};

export const actions = {
  deleteStoryForEveryone,
  loadStoryReplies,
  markStoryRead,
  queueStoryDownload,
  reactToStory,
  replyToStory,
  sendStoryMessage,
  storyChanged,
  toggleStoriesView,
  viewUserStories,
  viewStory,
};

export const useStoriesActions = (): typeof actions => useBoundActions(actions);

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
      selectedStoryData: state.isShowingStoriesView
        ? undefined
        : state.selectedStoryData,
      storyViewMode: state.isShowingStoriesView
        ? undefined
        : state.storyViewMode,
    };
  }

  if (action.type === 'MESSAGE_DELETED') {
    const nextStories = state.stories.filter(
      story => story.messageId !== action.payload.id
    );

    if (nextStories.length === state.stories.length) {
      return state;
    }

    return {
      ...state,
      stories: nextStories,
    };
  }

  if (action.type === STORY_CHANGED) {
    const newStory = pick(action.payload, [
      'attachment',
      'canReplyToStory',
      'conversationId',
      'deletedForEveryone',
      'messageId',
      'reactions',
      'readStatus',
      'sendStateByConversationId',
      'source',
      'sourceUuid',
      'storyDistributionListId',
      'timestamp',
      'type',
    ]);

    const prevStoryIndex = state.stories.findIndex(
      existingStory => existingStory.messageId === newStory.messageId
    );
    if (prevStoryIndex >= 0) {
      const prevStory = state.stories[prevStoryIndex];

      // Stories rarely need to change, here are the following exceptions:
      const isDownloadingAttachment = isDownloading(newStory.attachment);
      const hasAttachmentDownloaded =
        !isDownloaded(prevStory.attachment) &&
        isDownloaded(newStory.attachment);
      const hasAttachmentFailed =
        hasFailed(newStory.attachment) && !hasFailed(prevStory.attachment);
      const readStatusChanged = prevStory.readStatus !== newStory.readStatus;
      const reactionsChanged =
        prevStory.reactions?.length !== newStory.reactions?.length;
      const hasBeenDeleted =
        !prevStory.deletedForEveryone && newStory.deletedForEveryone;
      const hasSendStateChanged = !isEqual(
        prevStory.sendStateByConversationId,
        newStory.sendStateByConversationId
      );

      const shouldReplace =
        isDownloadingAttachment ||
        hasAttachmentDownloaded ||
        hasAttachmentFailed ||
        hasBeenDeleted ||
        hasSendStateChanged ||
        readStatusChanged ||
        reactionsChanged;
      if (!shouldReplace) {
        return state;
      }

      if (hasBeenDeleted) {
        return {
          ...state,
          stories: state.stories.filter(
            existingStory => existingStory.messageId !== newStory.messageId
          ),
        };
      }

      return {
        ...state,
        stories: replaceIndex(state.stories, prevStoryIndex, newStory),
      };
    }

    // Adding a new story
    const stories = [...state.stories, newStory].sort((a, b) =>
      a.timestamp > b.timestamp ? 1 : -1
    );

    return {
      ...state,
      stories,
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

  if (action.type === LOAD_STORY_REPLIES) {
    return {
      ...state,
      replyState: action.payload,
    };
  }

  if (action.type === 'MESSAGES_ADDED' && action.payload.isJustSent) {
    const stories = action.payload.messages.filter(isStory);
    if (!stories.length) {
      return state;
    }

    const newStories = stories
      .map(messageAttrs => getStoryDataFromMessageAttributes(messageAttrs))
      .filter(isNotNil);

    if (!newStories.length) {
      return state;
    }

    return {
      ...state,
      stories: [...state.stories, ...newStories],
    };
  }

  // For live updating of the story replies
  if (
    action.type === 'MESSAGE_CHANGED' &&
    state.replyState &&
    state.replyState.messageId === action.payload.data.storyId
  ) {
    const { replyState } = state;
    const messageIndex = replyState.replies.findIndex(
      reply => reply.id === action.payload.id
    );

    // New message
    if (messageIndex < 0) {
      return {
        ...state,
        replyState: {
          messageId: replyState.messageId,
          replies: [...replyState.replies, action.payload.data],
        },
      };
    }

    // Changed message, also handles DOE
    return {
      ...state,
      replyState: {
        messageId: replyState.messageId,
        replies: replaceIndex(
          replyState.replies,
          messageIndex,
          action.payload.data
        ),
      },
    };
  }

  if (action.type === REPLY_TO_STORY) {
    const { replyState } = state;
    if (!replyState) {
      return state;
    }

    return {
      ...state,
      replyState: {
        messageId: replyState.messageId,
        replies: [...replyState.replies, action.payload],
      },
    };
  }

  if (action.type === RESOLVE_ATTACHMENT_URL) {
    const { messageId, attachmentUrl } = action.payload;

    const storyIndex = state.stories.findIndex(
      existingStory => existingStory.messageId === messageId
    );

    if (storyIndex < 0) {
      return state;
    }

    const story = state.stories[storyIndex];

    if (!story.attachment) {
      return state;
    }

    const storyWithResolvedAttachment = {
      ...story,
      attachment: {
        ...story.attachment,
        url: attachmentUrl,
      },
    };

    return {
      ...state,
      stories: replaceIndex(
        state.stories,
        storyIndex,
        storyWithResolvedAttachment
      ),
    };
  }

  if (action.type === DOE_STORY) {
    return {
      ...state,
      stories: state.stories.filter(
        existingStory => existingStory.messageId !== action.payload
      ),
    };
  }

  if (action.type === VIEW_STORY) {
    const { selectedStoryData, storyViewMode } = action.payload || {};

    return {
      ...state,
      selectedStoryData,
      storyViewMode,
    };
  }

  return state;
}
