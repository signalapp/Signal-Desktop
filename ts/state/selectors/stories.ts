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
import { MY_STORIES_ID } from '../../types/Stories';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SendStatus } from '../../messages/MessageSendState';
import { canReply } from './message';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getMe,
} from './conversations';
import { getDistributionListSelector } from './storyDistributionLists';

export const getStoriesState = (state: StateType): StoriesStateType =>
  state.stories;

export const shouldShowStoriesView = createSelector(
  getStoriesState,
  ({ isShowingStoriesView }): boolean => isShowingStoriesView
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
  | 'color'
  | 'isMe'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> {
  return pick(conversation, [
    'acceptedMessageRequest',
    'avatarPath',
    'color',
    'isMe',
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
        recipient: pick(recipient, [
          'acceptedMessageRequest',
          'avatarPath',
          'color',
          'id',
          'isMe',
          'name',
          'profileName',
          'sharedGroupNames',
          'title',
        ]),
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
            ...getAvatarData(conversation),
            contactNameColor: contactNameColorSelector(
              foundStory.conversationId,
              conversation.id
            ),
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
        ...getAvatarData(conversation),
        ...pick(reply, ['body', 'deletedForEveryone', 'id', 'timestamp']),
        contactNameColor: contactNameColorSelector(
          reply.conversationId,
          conversation.id
        ),
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

      if (story.sendStateByConversationId && story.storyDistributionListId) {
        const list =
          story.storyDistributionListId === MY_STORIES_ID
            ? { id: MY_STORIES_ID, name: MY_STORIES_ID }
            : distributionListSelector(story.storyDistributionListId);

        if (!list) {
          return;
        }

        const storyView = getStoryView(conversationSelector, story);

        const existingMyStory = myStoriesById.get(list.id) || { stories: [] };

        myStoriesById.set(list.id, {
          distributionId: list.id,
          distributionName: list.name,
          stories: [...existingMyStory.stories, storyView],
        });

        return;
      }

      const conversationStory = getConversationStory(
        conversationSelector,
        story
      );

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
