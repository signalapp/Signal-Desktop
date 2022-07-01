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
import type { StoryDataType, StoriesStateType } from '../ducks/stories';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SendStatus } from '../../messages/MessageSendState';
import { canReply } from './message';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getMe,
} from './conversations';
import { getDistributionListSelector } from './storyDistributionLists';
import { getUserConversationId } from './user';

export const getStoriesState = (state: StateType): StoriesStateType =>
  state.stories;

export const shouldShowStoriesView = createSelector(
  getStoriesState,
  ({ isShowingStoriesView }): boolean => isShowingStoriesView
);

function getNewestStory(x: ConversationStoryType | MyStoryType): StoryViewType {
  return x.stories[x.stories.length - 1];
}

function sortByRecencyAndUnread(
  a: ConversationStoryType | MyStoryType,
  b: ConversationStoryType | MyStoryType
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

function getReactionUniqueId(reaction: MessageReactionType): string {
  return `${reaction.fromId}:${reaction.targetAuthorUuid}:${reaction.timestamp}`;
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

function getStoryView(
  conversationSelector: GetConversationByIdType,
  story: StoryDataType,
  ourConversationId?: string
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

  return {
    attachment,
    canReply: canReply(story, ourConversationId, conversationSelector),
    isUnread: story.readStatus === ReadStatus.Unread,
    messageId: story.messageId,
    sender,
    timestamp,
  };
}

function getConversationStory(
  conversationSelector: GetConversationByIdType,
  story: StoryDataType,
  ourConversationId?: string
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

  const storyView = getStoryView(
    conversationSelector,
    story,
    ourConversationId
  );

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
  getUserConversationId,
  shouldShowStoriesView,
  (
    conversationSelector,
    distributionListSelector,
    { stories }: Readonly<StoriesStateType>,
    ourConversationId,
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
        const list = distributionListSelector(story.storyDistributionListId);
        if (!list) {
          return;
        }

        const storyView = getStoryView(
          conversationSelector,
          story,
          ourConversationId
        );

        const sendState: Array<StorySendStateType> = [];
        const { sendStateByConversationId } = story;

        let views = 0;
        Object.keys(story.sendStateByConversationId).forEach(recipientId => {
          const recipient = conversationSelector(recipientId);

          const recipientSendState = sendStateByConversationId[recipient.id];
          if (recipientSendState.status === SendStatus.Viewed) {
            views += 1;
          }

          sendState.push({
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

        const existingMyStory = myStoriesById.get(list.id) || { stories: [] };

        myStoriesById.set(list.id, {
          distributionId: list.id,
          distributionName: list.name,
          stories: [
            ...existingMyStory.stories,
            {
              ...storyView,
              sendState,
              views,
            },
          ],
        });

        return;
      }

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
      myStories: Array.from(myStoriesById.values()).sort(
        sortByRecencyAndUnread
      ),
      stories: Array.from(storiesById.values()).sort(sortByRecencyAndUnread),
    };
  }
);
