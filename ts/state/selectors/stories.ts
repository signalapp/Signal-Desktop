// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { pick } from 'lodash';

import type { GetConversationByIdType } from './conversations';
import type { ConversationType } from '../ducks/conversations';
import type { MessageReactionType } from '../../model-types.d';
import type {
  ConversationStoryType,
  MyStoryType,
  ReplyStateType,
  StorySendStateType,
  StoryViewType,
} from '../../types/Stories';
import type { StateType } from '../reducer';
import type {
  SelectedStoryDataType,
  StoryDataType,
  StoriesStateType,
} from '../ducks/stories';
import { HasStories, MY_STORIES_ID } from '../../types/Stories';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SendStatus } from '../../messages/MessageSendState';
import { canReply } from './message';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getMe,
} from './conversations';
import { getDistributionListSelector } from './storyDistributionLists';
import { getStoriesEnabled } from './items';

export const getStoriesState = (state: StateType): StoriesStateType =>
  state.stories;

export const shouldShowStoriesView = createSelector(
  getStoriesState,
  ({ isShowingStoriesView }): boolean => isShowingStoriesView
);

export const hasSelectedStoryData = createSelector(
  getStoriesState,
  ({ selectedStoryData }): boolean => Boolean(selectedStoryData)
);

export const getSelectedStoryData = createSelector(
  getStoriesState,
  ({ selectedStoryData }): SelectedStoryDataType | undefined =>
    selectedStoryData
);

function getReactionUniqueId(reaction: MessageReactionType): string {
  return `${reaction.fromId}:${reaction.targetAuthorUuid}:${reaction.timestamp}`;
}

function sortByRecencyAndUnread(
  storyA: ConversationStoryType,
  storyB: ConversationStoryType
): number {
  if (storyA.storyView.isUnread && storyB.storyView.isUnread) {
    return storyA.storyView.timestamp > storyB.storyView.timestamp ? -1 : 1;
  }

  if (storyB.storyView.isUnread) {
    return 1;
  }

  if (storyA.storyView.isUnread) {
    return -1;
  }

  return storyA.storyView.timestamp > storyB.storyView.timestamp ? -1 : 1;
}

function getAvatarData(
  conversation: ConversationType
): Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
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
    'avatarPath',
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

export function getStoryView(
  conversationSelector: GetConversationByIdType,
  story: StoryDataType
): StoryViewType {
  const sender = pick(conversationSelector(story.sourceUuid || story.source), [
    'acceptedMessageRequest',
    'avatarPath',
    'badges',
    'color',
    'firstName',
    'hideStory',
    'id',
    'isMe',
    'name',
    'profileName',
    'sharedGroupNames',
    'title',
  ]);

  const { attachment, timestamp } = pick(story, ['attachment', 'timestamp']);

  const { sendStateByConversationId } = story;
  let sendState: Array<StorySendStateType> | undefined;
  let views: number | undefined;

  if (sendStateByConversationId) {
    const innerSendState: Array<StorySendStateType> = [];
    let innerViews = 0;

    Object.keys(sendStateByConversationId).forEach(recipientId => {
      const recipient = conversationSelector(recipientId);

      const recipientSendState = sendStateByConversationId[recipient.id];
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

  return {
    attachment,
    canReply: canReply(story, undefined, conversationSelector),
    isUnread: story.readStatus === ReadStatus.Unread,
    messageId: story.messageId,
    sender,
    sendState,
    timestamp,
    views,
  };
}

export function getConversationStory(
  conversationSelector: GetConversationByIdType,
  story: StoryDataType
): ConversationStoryType {
  const sender = pick(conversationSelector(story.sourceUuid || story.source), [
    'hideStory',
    'id',
  ]);

  const conversation = pick(conversationSelector(story.conversationId), [
    'acceptedMessageRequest',
    'avatarPath',
    'color',
    'id',
    'name',
    'profileName',
    'sharedGroupNames',
    'title',
  ]);

  const storyView = getStoryView(conversationSelector, story);

  return {
    conversationId: conversation.id,
    group: conversation.id !== sender.id ? conversation : undefined,
    isHidden: Boolean(sender.hideStory),
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
    { stories, replyState }: Readonly<StoriesStateType>
  ): ReplyStateType | undefined => {
    if (!replyState) {
      return;
    }

    const foundStory = stories.find(
      story => story.messageId === replyState.messageId
    );

    const reactions = foundStory
      ? (foundStory.reactions || []).map(reaction => {
          const conversation = conversationSelector(reaction.fromId);

          return {
            author: getAvatarData(conversation),
            contactNameColor: contactNameColorSelector(
              foundStory.conversationId,
              conversation.id
            ),
            conversationId: reaction.fromId,
            id: getReactionUniqueId(reaction),
            reactionEmoji: reaction.emoji,
            timestamp: reaction.timestamp,
          };
        })
      : [];

    const replies = replyState.replies.map(reply => {
      const conversation =
        reply.type === 'outgoing'
          ? me
          : conversationSelector(reply.sourceUuid || reply.source);

      return {
        author: getAvatarData(conversation),
        ...pick(reply, ['body', 'deletedForEveryone', 'id', 'timestamp']),
        contactNameColor: contactNameColorSelector(
          reply.conversationId,
          conversation.id
        ),
        conversationId: conversation.id,
        readStatus: reply.readStatus,
      };
    });

    const combined = [...replies, ...reactions].sort((a, b) =>
      a.timestamp > b.timestamp ? 1 : -1
    );

    return {
      messageId: replyState.messageId,
      replies: combined,
    };
  }
);

export const getStories = createSelector(
  getConversationSelector,
  getDistributionListSelector,
  getStoriesState,
  shouldShowStoriesView,
  (
    conversationSelector,
    distributionListSelector,
    { stories }: Readonly<StoriesStateType>,
    isShowingStoriesView
  ): {
    hiddenStories: Array<ConversationStoryType>;
    myStories: Array<MyStoryType>;
    stories: Array<ConversationStoryType>;
  } => {
    if (!isShowingStoriesView) {
      return {
        hiddenStories: [],
        myStories: [],
        stories: [],
      };
    }

    const hiddenStoriesById = new Map<string, ConversationStoryType>();
    const myStoriesById = new Map<string, MyStoryType>();
    const storiesById = new Map<string, ConversationStoryType>();

    stories.forEach(story => {
      if (story.deletedForEveryone) {
        return;
      }

      const conversationStory = getConversationStory(
        conversationSelector,
        story
      );

      if (story.sendStateByConversationId) {
        let sentId = story.conversationId;
        let sentName = conversationStory.group?.title;

        if (story.storyDistributionListId) {
          const list =
            story.storyDistributionListId === MY_STORIES_ID
              ? { id: MY_STORIES_ID, name: MY_STORIES_ID }
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

        const storyView = getStoryView(conversationSelector, story);

        const existingMyStory = myStoriesById.get(sentId) || { stories: [] };

        myStoriesById.set(sentId, {
          id: sentId,
          name: sentName,
          stories: [...existingMyStory.stories, storyView],
        });

        return;
      }

      let storiesMap: Map<string, ConversationStoryType>;

      if (conversationStory.isHidden) {
        storiesMap = hiddenStoriesById;
      } else {
        storiesMap = storiesById;
      }

      const existingConversationStory = storiesMap.get(
        conversationStory.conversationId
      );

      storiesMap.set(conversationStory.conversationId, {
        ...existingConversationStory,
        ...conversationStory,
        storyView: conversationStory.storyView,
      });
    });

    return {
      hiddenStories: Array.from(hiddenStoriesById.values()),
      myStories: Array.from(myStoriesById.values()),
      stories: Array.from(storiesById.values()).sort(sortByRecencyAndUnread),
    };
  }
);

export const getUnreadStorySenderCount = createSelector(
  getStoriesState,
  ({ stories }): number => {
    return new Set(
      stories
        .filter(
          story =>
            story.readStatus === ReadStatus.Unread && !story.deletedForEveryone
        )
        .map(story => story.conversationId)
    ).size;
  }
);

export const getHasStoriesSelector = createSelector(
  getStoriesEnabled,
  getStoriesState,
  (isEnabled, { stories }) =>
    (conversationId?: string): HasStories | undefined => {
      if (!isEnabled || !conversationId) {
        return;
      }

      const conversationStories = stories.filter(
        story => story.conversationId === conversationId
      );

      if (!conversationStories.length) {
        return;
      }

      return conversationStories.some(
        story =>
          story.readStatus === ReadStatus.Unread && !story.deletedForEveryone
      )
        ? HasStories.Unread
        : HasStories.Read;
    }
);

export const getStoryByIdSelector = createSelector(
  getStoriesState,
  ({ stories }) =>
    (
      conversationSelector: GetConversationByIdType,
      messageId: string
    ):
      | { conversationStory: ConversationStoryType; storyView: StoryViewType }
      | undefined => {
      const story = stories.find(item => item.messageId === messageId);

      if (!story) {
        return;
      }

      return {
        conversationStory: getConversationStory(conversationSelector, story),
        storyView: getStoryView(conversationSelector, story),
      };
    }
);
