// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from './Attachment';
import type { ContactNameColorType } from './Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from './Util';
import type { ReadStatus } from '../messages/MessageReadStatus';
import type { SendStatus } from '../messages/MessageSendState';
import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists';

export type ReplyType = {
  author: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'badges'
    | 'color'
    | 'id'
    | 'isMe'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  body?: string;
  contactNameColor?: ContactNameColorType;
  conversationId: string;
  deletedForEveryone?: boolean;
  id: string;
  reactionEmoji?: string;
  readStatus?: ReadStatus;
  timestamp: number;
};

export type ReplyStateType = {
  messageId: string;
  replies: Array<ReplyType>;
};

export type ConversationStoryType = {
  conversationId: string;
  group?: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'id'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  isHidden?: boolean;
  searchNames?: string; // This is just here to satisfy Fuse's types
  storyView: StoryViewType;
};

export type StorySendStateType = {
  isAllowedToReplyToStory?: boolean;
  recipient: ConversationType;
  status: SendStatus;
  updatedAt?: number;
};

export type StoryViewType = {
  attachment?: AttachmentType;
  canReply?: boolean;
  hasReplies?: boolean;
  hasRepliesFromSelf?: boolean;
  isHidden?: boolean;
  isUnread?: boolean;
  messageId: string;
  sender: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'badges'
    | 'color'
    | 'firstName'
    | 'id'
    | 'isMe'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  sendState?: Array<StorySendStateType>;
  timestamp: number;
  views?: number;
};

export type MyStoryType = {
  id: string;
  name: string;
  stories: Array<StoryViewType>;
};

export const MY_STORIES_ID = '00000000-0000-0000-0000-000000000000';

export enum StoryViewDirectionType {
  Next = 'Next',
  Previous = 'Previous',
}

export enum StoryViewModeType {
  Unread = 'Unread',
  All = 'All',
  Single = 'Single',
}

export type StoryDistributionListWithMembersDataType = Omit<
  StoryDistributionListDataType,
  'memberUuids'
> & {
  members: Array<ConversationType>;
};

export function getStoryDistributionListName(
  i18n: LocalizerType,
  id: string,
  name: string
): string {
  return id === MY_STORIES_ID ? i18n('Stories__mine') : name;
}

export enum HasStories {
  Read = 'Read',
  Unread = 'Unread',
}
