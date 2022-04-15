// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { pick } from 'lodash';

import type { GetConversationByIdType } from './conversations';
import type {
  ConversationStoryType,
  StoryViewType,
} from '../../components/StoryListItem';
import type { ReplyStateType } from '../../types/Stories';
import type { StateType } from '../reducer';
import type { StoryDataType, StoriesStateType } from '../ducks/stories';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { canReply } from './message';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getMe,
} from './conversations';
import { getUserConversationId } from './user';

export const getStoriesState = (state: StateType): StoriesStateType =>
  state.stories;

export const shouldShowStoriesView = createSelector(
  getStoriesState,
  ({ isShowingStoriesView }): boolean => isShowingStoriesView
);

function getNewestStory(x: ConversationStoryType): StoryViewType {
  return x.stories[x.stories.length - 1];
}

function sortByRecencyAndUnread(
  a: ConversationStoryType,
  b: ConversationStoryType
): number {
  const storyA = getNewestStory(a);
  const storyB = getNewestStory(b);

  if (storyA.isUnread && storyB.isUnread) {
    return storyA.timestamp > storyB.timestamp ? -1 : 1;
  }

  if (storyB.isUnread) {
    return 1;
  }

  if (storyA.isUnread) {
    return -1;
  }

  return storyA.timestamp > storyB.timestamp ? -1 : 1;
}

function getConversationStory(
  conversationSelector: GetConversationByIdType,
  story: StoryDataType,
  ourConversationId?: string
): ConversationStoryType {
  const sender = pick(conversationSelector(story.sourceUuid || story.source), [
    'acceptedMessageRequest',
    'avatarPath',
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

  const { attachment, timestamp } = pick(story, ['attachment', 'timestamp']);

  const storyView: StoryViewType = {
    attachment,
    canReply: canReply(story, ourConversationId, conversationSelector),
    isUnread: story.readStatus === ReadStatus.Unread,
    messageId: story.messageId,
    selectedReaction: story.selectedReaction,
    sender,
    timestamp,
  };

  return {
    conversationId: conversation.id,
    group: conversation.id !== sender.id ? conversation : undefined,
    isHidden: Boolean(sender.hideStory),
    stories: [storyView],
  };
}

export type GetStoriesByConversationIdType = (
  conversationId: string
) => ConversationStoryType;
export const getStoriesSelector = createSelector(
  getConversationSelector,
  getUserConversationId,
  getStoriesState,
  (
    conversationSelector,
    ourConversationId,
    { stories }: Readonly<StoriesStateType>
  ): GetStoriesByConversationIdType => {
    return conversationId => {
      const conversationStoryAcc: ConversationStoryType = {
        conversationId,
        stories: [],
      };

      return stories.reduce((acc, story) => {
        if (story.conversationId !== conversationId) {
          return acc;
        }

        const conversationStory = getConversationStory(
          conversationSelector,
          story,
          ourConversationId
        );

        return {
          ...acc,
          ...conversationStory,
          stories: [...acc.stories, ...conversationStory.stories],
        };
      }, conversationStoryAcc);
    };
  }
);

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

    return {
      messageId: replyState.messageId,
      replies: replyState.replies.map(reply => {
        const conversation =
          reply.type === 'outgoing'
            ? me
            : conversationSelector(reply.sourceUuid || reply.source);

        return {
          ...pick(conversation, [
            'acceptedMessageRequest',
            'avatarPath',
            'color',
            'isMe',
            'name',
            'profileName',
            'sharedGroupNames',
            'title',
          ]),
          ...pick(reply, ['body', 'deletedForEveryone', 'id', 'timestamp']),
          contactNameColor: contactNameColorSelector(
            reply.conversationId,
            conversation.id
          ),
        };
      }),
    };
  }
);

export const getStories = createSelector(
  getConversationSelector,
  getUserConversationId,
  getStoriesState,
  shouldShowStoriesView,
  (
    conversationSelector,
    ourConversationId,
    { stories }: Readonly<StoriesStateType>,
    isShowingStoriesView
  ): {
    hiddenStories: Array<ConversationStoryType>;
    stories: Array<ConversationStoryType>;
  } => {
    if (!isShowingStoriesView) {
      return {
        hiddenStories: [],
        stories: [],
      };
    }

    const storiesById = new Map<string, ConversationStoryType>();
    const hiddenStoriesById = new Map<string, ConversationStoryType>();

    stories.forEach(story => {
      const conversationStory = getConversationStory(
        conversationSelector,
        story,
        ourConversationId
      );

      let storiesMap: Map<string, ConversationStoryType>;
      if (conversationStory.isHidden) {
        storiesMap = hiddenStoriesById;
      } else {
        storiesMap = storiesById;
      }

      const existingConversationStory = storiesMap.get(
        conversationStory.conversationId
      ) || { stories: [] };

      storiesMap.set(conversationStory.conversationId, {
        ...existingConversationStory,
        ...conversationStory,
        stories: [
          ...existingConversationStory.stories,
          ...conversationStory.stories,
        ],
      });
    });

    return {
      hiddenStories: Array.from(hiddenStoriesById.values()).sort(
        sortByRecencyAndUnread
      ),
      stories: Array.from(storiesById.values()).sort(sortByRecencyAndUnread),
    };
  }
);
