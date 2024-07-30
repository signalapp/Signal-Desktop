// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from './Attachment';
import type { HydratedBodyRangesType } from './BodyRange';
import type { LocalizerType } from './Util';
import type { ContactNameColorType } from './Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { ReadStatus } from '../messages/MessageReadStatus';
import type { SendStatus } from '../messages/MessageSendState';
import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists';
import type { ServiceIdString } from './ServiceId';
import type { StoryDistributionIdString } from './StoryDistributionId';

export type ReplyType = {
  author: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
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
  bodyRanges?: HydratedBodyRangesType;
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
  replies: ReadonlyArray<ReplyType>;
};

export type ConversationStoryType = {
  conversationId: string;
  hasReplies?: boolean;
  hasRepliesFromSelf?: boolean;
  group?: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'color'
    | 'id'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'sortedGroupMembers'
    | 'title'
    | 'left'
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
  bodyRanges?: HydratedBodyRangesType;
  canReply?: boolean;
  isHidden?: boolean;
  isUnread?: boolean;
  messageId: string;
  messageIdForLogging: string;
  readAt?: number;
  sender: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'firstName'
    | 'hideStory'
    | 'id'
    | 'isMe'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'serviceId'
  >;
  sendState?: Array<StorySendStateType>;
  timestamp: number;
  expirationTimestamp: number | undefined;
  views?: number;
};

export type MyStoryType = {
  // Either a distribution list id or a conversation (group) id
  id: StoryDistributionIdString | string;
  name: string;
  reducedSendStatus: ResolvedSendStatus;
  stories: Array<StoryViewType>;
};

export const MY_STORY_ID: StoryDistributionIdString =
  '00000000-0000-0000-0000-000000000000' as StoryDistributionIdString;

export enum StoryViewDirectionType {
  Next = 'Next',
  Previous = 'Previous',
}

export enum StoryViewTargetType {
  Details = 'Details',
  Views = 'Views',
  Replies = 'Replies',
}

// Type of stories to view before closing the viewer
// All = All the stories in order
// Single = A single story. Like when clicking on a quoted story
// Unread = View only unread stories
// User = All of a user's stories
export enum StoryViewModeType {
  All = 'All',
  Hidden = 'Hidden',
  MyStories = 'MyStories',
  Single = 'Single',
  Unread = 'Unread',
  User = 'User',
}

export type StoryDistributionListWithMembersDataType = Omit<
  StoryDistributionListDataType,
  'memberServiceIds'
> & {
  members: Array<ConversationType>;
};

export function getStoryDistributionListName(
  i18n: LocalizerType,
  // Distribution id or conversation (group) id
  id: StoryDistributionIdString | string | undefined,
  name: string
): string {
  return id === MY_STORY_ID ? i18n('icu:Stories__mine') : name;
}

export enum HasStories {
  Read = 'Read',
  Unread = 'Unread',
}

export enum StorySendMode {
  IfActive = 'IfActive',
  Always = 'Always',
  Never = 'Never',
}

export enum ResolvedSendStatus {
  Failed = 'Failed',
  PartiallySent = 'PartiallySent',
  Sending = 'Sending',
  Sent = 'Sent',
}

export type StoryMessageRecipientsType = Array<{
  destinationServiceId?: ServiceIdString;
  distributionListIds: Array<StoryDistributionIdString>;
  isAllowedToReply: boolean;
}>;
