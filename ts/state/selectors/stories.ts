// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import lodash from 'lodash';

import type { GetConversationByIdType } from './conversations.dom.js';
import type { ConversationType } from '../ducks/conversations.preload.js';
import type { AttachmentType } from '../../types/Attachment.std.js';
import type {
  ConversationStoryType,
  MyStoryType,
  ReplyStateType,
  StoryDistributionListWithMembersDataType,
  StorySendStateType,
  StoryViewType,
} from '../../types/Stories.std.js';
import type { StateType } from '../reducer.preload.js';
import type {
  SelectedStoryDataType,
  StoryDataType,
  StoriesStateType,
  AddStoryData,
} from '../ducks/stories.preload.js';
import { MY_STORY_ID, ResolvedSendStatus } from '../../types/Stories.std.js';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { SendStatus } from '../../messages/MessageSendState.std.js';
import { canReply } from './message.preload.js';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getHideStoryConversationIds,
  getMe,
  PLACEHOLDER_CONTACT_ID,
} from './conversations.dom.js';
import { getUserConversationId } from './user.std.js';
import { getDistributionListSelector } from './storyDistributionLists.dom.js';
import { calculateExpirationTimestamp } from '../../util/expirationTimer.std.js';
import { getMessageIdForLogging } from '../../util/idForLogging.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { SIGNAL_ACI } from '../../types/SignalConversation.std.js';
import {
  reduceStorySendStatus,
  resolveStorySendStatus,
} from '../../util/resolveStorySendStatus.std.js';
import { BodyRange, hydrateRanges } from '../../types/BodyRange.std.js';
import { getStoriesEnabled } from './items.dom.js';

const { pick } = lodash;

const log = createLogger('stories');

export const getStoriesState = (state: StateType): StoriesStateType =>
  state.stories;

export const hasSelectedStoryData = createSelector(
  getStoriesState,
  ({ selectedStoryData }): boolean => Boolean(selectedStoryData)
);

export const getSelectedStoryData = createSelector(
  getStoriesState,
  ({ selectedStoryData }): SelectedStoryDataType | undefined =>
    selectedStoryData
);

export const getAddStoryData = createSelector(
  getStoriesState,
  ({ addStoryData }): AddStoryData => addStoryData
);

function sortByRecencyAndUnread(
  storyA: ConversationStoryType,
  storyB: ConversationStoryType
): number {
  if (
    storyA.storyView.sender.serviceId === SIGNAL_ACI &&
    storyA.storyView.isUnread
  ) {
    return -1;
  }

  if (
    storyB.storyView.sender.serviceId === SIGNAL_ACI &&
    storyB.storyView.isUnread
  ) {
    return 1;
  }

  if (storyA.storyView.isUnread && storyB.storyView.isUnread) {
    return storyA.storyView.timestamp > storyB.storyView.timestamp ? -1 : 1;
  }

  if (storyB.storyView.isUnread) {
    return 1;
  }

  if (storyA.storyView.isUnread) {
    return -1;
  }

  if (storyA.storyView.readAt && storyB.storyView.readAt) {
    return storyA.storyView.readAt > storyB.storyView.readAt ? -1 : 1;
  }

  return storyA.storyView.timestamp > storyB.storyView.timestamp ? -1 : 1;
}

function sortMyStories(storyA: MyStoryType, storyB: MyStoryType): number {
  if (storyA.id === MY_STORY_ID) {
    return -1;
  }

  if (storyB.id === MY_STORY_ID) {
    return 1;
  }

  if (!storyA.stories.length) {
    return 1;
  }

  if (!storyB.stories.length) {
    return -1;
  }

  return storyA.stories[0].timestamp > storyB.stories[0].timestamp ? -1 : 1;
}

function getAvatarData(
  conversation: ConversationType
): Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'badges'
  | 'color'
  | 'isMe'
  | 'id'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> {
  return pick(conversation, [
    'acceptedMessageRequest',
    'avatarUrl',
    'badges',
    'color',
    'isMe',
    'id',
    'name',
    'profileName',
    'sharedGroupNames',
    'title',
  ]);
}

export function getStoryDownloadableAttachment({
  attachment,
}: StoryDataType): AttachmentType | undefined {
  // See: getStoryDataFromMessageAttributes for how preview gets populated.
  return attachment?.textAttachment?.preview?.image ?? attachment;
}

export function getStoryView(
  conversationSelector: GetConversationByIdType,
  ourConversationId: string | undefined,
  story: StoryDataType
): StoryViewType {
  const sender = pick(
    conversationSelector(story.sourceServiceId || story.source),
    [
      'avatarPlaceholderGradient',
      'acceptedMessageRequest',
      'avatarUrl',
      'badges',
      'color',
      'firstName',
      'hasAvatar',
      'hideStory',
      'id',
      'isMe',
      'name',
      'profileName',
      'sharedGroupNames',
      'title',
      'serviceId',
    ]
  );

  const {
    attachment,
    bodyRanges,
    expirationStartTimestamp,
    expireTimer,
    readAt,
    timestamp,
  } = story;
  const logId = `getStoryView/${timestamp}`;

  const { sendStateByConversationId } = story;
  let sendState: Array<StorySendStateType> | undefined;
  let views: number | undefined;

  if (sendStateByConversationId) {
    const innerSendState: Array<StorySendStateType> = [];
    let innerViews = 0;

    Object.keys(sendStateByConversationId).forEach(recipientId => {
      const recipient = conversationSelector(recipientId);
      if (recipient.id === PLACEHOLDER_CONTACT_ID) {
        log.warn(
          `${logId}: Found only placeholder contact for conversation ${recipientId}, skipping`
        );
        return;
      }

      const recipientSendState = sendStateByConversationId[recipient.id];
      if (!recipientSendState) {
        log.warn(
          `${logId}: No recipientSendState found for ${recipient.serviceId}, skipping.`
        );
        return;
      }

      if (recipientSendState.status === SendStatus.Viewed) {
        innerViews += 1;
      }

      innerSendState.push({
        ...recipientSendState,
        recipient,
      });
    });

    sendState = innerSendState;
    views = innerViews;
  }

  const messageIdForLogging = getMessageIdForLogging({
    ...pick(story, 'type', 'sourceServiceId', 'sourceDevice'),
    sent_at: story.timestamp,
  });

  return {
    attachment,
    bodyRanges: bodyRanges?.filter(BodyRange.isFormatting),
    canReply: canReply(story, ourConversationId, conversationSelector),
    isHidden: Boolean(sender.hideStory),
    isUnread: story.readStatus === ReadStatus.Unread,
    messageId: story.messageId,
    messageIdForLogging,
    readAt,
    sender,
    sendState,
    timestamp,
    expirationTimestamp: calculateExpirationTimestamp({
      expireTimer,
      expirationStartTimestamp,
    }),
    views,
  };
}

export function getConversationStory(
  conversationSelector: GetConversationByIdType,
  ourConversationId: string | undefined,
  story: StoryDataType
): ConversationStoryType {
  const sender = pick(
    conversationSelector(story.sourceServiceId || story.source),
    ['id']
  );

  const conversation = pick(conversationSelector(story.conversationId), [
    'acceptedMessageRequest',
    'avatarUrl',
    'color',
    'hideStory',
    'id',
    'name',
    'profileName',
    'sharedGroupNames',
    'sortedGroupMembers',
    'title',
    'left',
  ]);

  const storyView = getStoryView(
    conversationSelector,
    ourConversationId,
    story
  );

  return {
    conversationId: conversation.id,
    group: conversation.id !== sender.id ? conversation : undefined,
    hasReplies: story.hasReplies,
    hasRepliesFromSelf: story.hasRepliesFromSelf,
    isHidden: Boolean(conversation.hideStory),
    storyView,
  };
}

export const getStoryReplies = createSelector(
  getConversationSelector,
  getContactNameColorSelector,
  getMe,
  getStoriesState,
  (
    conversationSelector,
    contactNameColorSelector,
    me,
    { replyState }: Readonly<StoriesStateType>
  ): ReplyStateType | undefined => {
    if (!replyState) {
      return;
    }

    const replies = replyState.replies.map(reply => {
      const conversation =
        reply.type === 'outgoing'
          ? me
          : conversationSelector(reply.sourceServiceId || reply.source);

      return {
        author: getAvatarData(conversation),
        ...pick(reply, ['body', 'deletedForEveryone', 'id', 'timestamp']),
        bodyRanges: hydrateRanges(reply.bodyRanges, conversationSelector),
        reactionEmoji: reply.storyReaction?.emoji,
        contactNameColor: contactNameColorSelector(
          reply.conversationId,
          conversation.id
        ),
        conversationId: conversation.id,
        readStatus: reply.readStatus,
      };
    });

    return {
      messageId: replyState.messageId,
      replies,
    };
  }
);

export const getStories = createSelector(
  getConversationSelector,
  getDistributionListSelector,
  getStoriesState,
  getUserConversationId,
  (
    conversationSelector,
    distributionListSelector,
    { stories }: Readonly<StoriesStateType>,
    ourConversationId
  ): {
    hiddenStories: Array<ConversationStoryType>;
    myStories: Array<MyStoryType>;
    stories: Array<ConversationStoryType>;
  } => {
    const hiddenStoriesById = new Map<string, ConversationStoryType>();
    const myStoriesById = new Map<string, MyStoryType>();
    const storiesById = new Map<string, ConversationStoryType>();

    stories.forEach(story => {
      if (story.deletedForEveryone) {
        return;
      }

      const isSignalStory = story.sourceServiceId === SIGNAL_ACI;

      // if for some reason this story is already expired (bug)
      // log it and skip it. Unless it's the onboarding story, that story
      // doesn't have an expiration until it is viewed.
      if (
        !isSignalStory &&
        (calculateExpirationTimestamp(story) ?? 0) < Date.now()
      ) {
        const messageIdForLogging = getMessageIdForLogging({
          ...pick(story, 'type', 'sourceServiceId', 'sourceDevice'),
          sent_at: story.timestamp,
        });
        log.warn('selectors/getStories: story already expired', {
          message: messageIdForLogging,
          expireTimer: story.expireTimer,
          expirationStartTimestamp: story.expirationStartTimestamp,
        });
        return;
      }

      const conversationStory = getConversationStory(
        conversationSelector,
        ourConversationId,
        story
      );

      if (story.sendStateByConversationId) {
        let sentId = story.conversationId;
        let sentName = conversationStory.group?.title;

        if (story.storyDistributionListId) {
          const list =
            story.storyDistributionListId === MY_STORY_ID
              ? { id: MY_STORY_ID, name: MY_STORY_ID }
              : distributionListSelector(
                  story.storyDistributionListId.toLowerCase()
                );

          if (!list) {
            return;
          }

          sentId = list.id;
          sentName = list.name;
        }

        if (!sentName) {
          return;
        }

        const storyView = getStoryView(
          conversationSelector,
          ourConversationId,
          story
        );

        const existingStorySent = myStoriesById.get(sentId) || {
          // Default to "Sent" since it's the lowest form of SendStatus and all
          // others take precedence over it.
          reducedSendStatus: ResolvedSendStatus.Sent,
          stories: [],
        };

        const sendStatus = resolveStorySendStatus(storyView.sendState ?? []);

        myStoriesById.set(sentId, {
          id: sentId,
          name: sentName,
          reducedSendStatus: reduceStorySendStatus(
            existingStorySent.reducedSendStatus,
            sendStatus
          ),
          stories: [storyView, ...existingStorySent.stories],
        });

        // If it's a group story we still want it to render as part of regular
        // stories or hidden stories.
        if (story.storyDistributionListId) {
          return;
        }
      }

      let storiesMap: Map<string, ConversationStoryType>;
      if (conversationStory.isHidden) {
        storiesMap = hiddenStoriesById;
      } else {
        storiesMap = storiesById;
      }

      const existingConversationStory =
        storiesMap.get(conversationStory.conversationId) || conversationStory;

      const conversationStoryObject = {
        ...existingConversationStory,
        hasReplies:
          existingConversationStory?.hasReplies || conversationStory.hasReplies,
        hasRepliesFromSelf:
          existingConversationStory?.hasRepliesFromSelf ||
          conversationStory.hasRepliesFromSelf,
      };

      // For the signal story we want the thumbnail to be from the first story
      if (!isSignalStory) {
        conversationStoryObject.storyView = conversationStory.storyView;
      }

      storiesMap.set(conversationStory.conversationId, conversationStoryObject);
    });

    return {
      hiddenStories: Array.from(hiddenStoriesById.values()).sort(
        sortByRecencyAndUnread
      ),
      myStories: Array.from(myStoriesById.values()).sort(sortMyStories),
      stories: Array.from(storiesById.values()).sort(sortByRecencyAndUnread),
    };
  }
);

export const getStoriesNotificationCount = createSelector(
  getStoriesEnabled,
  getHideStoryConversationIds,
  getStoriesState,
  (
    storiesEnabled,
    hideStoryConversationIds,
    { lastOpenedAtTimestamp, stories }
  ): number => {
    if (!storiesEnabled) {
      return 0;
    }

    const hiddenConversationIds = new Set(hideStoryConversationIds);

    return new Set(
      stories
        .filter(
          story =>
            story.readStatus === ReadStatus.Unread &&
            !story.deletedForEveryone &&
            story.timestamp > (lastOpenedAtTimestamp || 0) &&
            !hiddenConversationIds.has(story.conversationId)
        )
        .map(story => story.conversationId)
    ).size;
  }
);

export const getStoryByIdSelector = createSelector(
  getStoriesState,
  getUserConversationId,
  getDistributionListSelector,
  ({ stories }, ourConversationId, distributionListSelector) =>
    (
      conversationSelector: GetConversationByIdType,
      messageId: string
    ):
      | {
          conversationStory: ConversationStoryType;
          distributionList:
            | Pick<StoryDistributionListWithMembersDataType, 'id' | 'name'>
            | undefined;
          storyView: StoryViewType;
        }
      | undefined => {
      const story = stories.find(item => item.messageId === messageId);

      if (!story) {
        return;
      }

      let distributionList:
        | Pick<StoryDistributionListWithMembersDataType, 'id' | 'name'>
        | undefined;
      if (story.storyDistributionListId) {
        distributionList =
          story.storyDistributionListId === MY_STORY_ID
            ? { id: MY_STORY_ID, name: MY_STORY_ID }
            : distributionListSelector(
                story.storyDistributionListId.toLowerCase()
              );
      }

      return {
        conversationStory: getConversationStory(
          conversationSelector,
          ourConversationId,
          story
        ),
        distributionList,
        storyView: getStoryView(conversationSelector, ourConversationId, story),
      };
    }
);

export const getHasAllStoriesUnmuted = createSelector(
  getStoriesState,
  ({ hasAllStoriesUnmuted }): boolean => hasAllStoriesUnmuted
);

export const getHasAnyFailedStorySends = createSelector(
  getStoriesState,
  ({ lastOpenedAtTimestamp, stories }): boolean => {
    return stories.some(
      story =>
        story.timestamp > (lastOpenedAtTimestamp || 0) &&
        Object.values(story.sendStateByConversationId || {}).some(
          ({ status }) => status === SendStatus.Failed
        )
    );
  }
);
