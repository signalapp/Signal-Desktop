// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from './Attachment';
import type { ContactNameColorType } from './Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { SendStatus } from '../messages/MessageSendState';

export type ReplyType = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'isMe'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  body?: string;
  contactNameColor?: ContactNameColorType;
  deletedForEveryone?: boolean;
  id: string;
  reactionEmoji?: string;
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
  recipient: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'id'
    | 'isMe'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
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
  distributionId: string;
  distributionName: string;
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
