// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Backbone from 'backbone';

import { GroupV2ChangeType } from './groups';
import { BodyRangeType, BodyRangesType } from './types/Util';
import { CallHistoryDetailsFromDiskType } from './types/Calling';
import { CustomColorType } from './types/Colors';
import { DeviceType } from './textsecure/Types';
import { SendMessageChallengeData } from './textsecure/Errors';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { ProfileNameChangeType } from './util/getStringForProfileChange';
import { CapabilitiesType } from './textsecure/WebAPI';
import { ReadStatus } from './messages/MessageReadStatus';
import { SendStateByConversationId } from './messages/MessageSendState';
import { GroupNameCollisionsWithIdsByTitle } from './util/groupMemberNameCollisions';
import { ConversationColorType } from './types/Colors';
import {
  AttachmentDraftType,
  AttachmentType,
  ThumbnailType,
} from './types/Attachment';
import { EmbeddedContactType } from './types/EmbeddedContact';
import { SignalService as Proto } from './protobuf';
import { AvatarDataType } from './types/Avatar';
import { UUIDStringType, UUIDKind } from './types/UUID';
import { ReactionSource } from './reactions/ReactionSource';

import AccessRequiredEnum = Proto.AccessControl.AccessRequired;
import MemberRoleEnum = Proto.Member.Role;
import { SeenStatus } from './MessageSeenStatus';
import { GiftBadgeStates } from './components/conversation/Message';
import { LinkPreviewType } from './types/message/LinkPreviews';

import type { ProcessedQuoteAttachment } from './textsecure/Types.d';
import type { StickerType } from './types/Stickers';
import { MIMEType } from './types/MIME';

export type LastMessageStatus =
  | 'paused'
  | 'error'
  | 'partial-sent'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'viewed';

type TaskResultType = any;

export type SenderKeyInfoType = {
  createdAtDate: number;
  distributionId: string;
  memberDevices: Array<DeviceType>;
};

export type CustomError = Error & {
  identifier?: string;
  number?: string;
  data?: object;
  retryAfter?: number;
};

export type GroupMigrationType = {
  areWeInvited: boolean;
  droppedMemberIds: Array<string>;
  invitedMembers: Array<GroupV2PendingMemberType>;
};

export type QuotedAttachment = {
  contentType: MIMEType;
  fileName?: string;
  thumbnail?: AttachmentType;
};

export type QuotedMessageType = {
  // TODO DESKTOP-3826
  // eslint-disable-next-line no-explicit-any
  attachments: Array<any>;
  // `author` is an old attribute that holds the author's E164. We shouldn't use it for
  //   new messages, but old messages might have this attribute.
  author?: string;
  authorUuid?: string;
  bodyRanges?: BodyRangesType;
  id: number;
  isGiftBadge?: boolean;
  isViewOnce: boolean;
  messageId: string;
  referencedMessageNotFound: boolean;
  text?: string;
};

type StoryReplyContextType = {
  attachment?: AttachmentType;
  authorUuid?: string;
  messageId: string;
};

export type RetryOptions = Readonly<{
  type: 'session-reset';
  uuid: string;
  e164: string;
  now: number;
}>;

export type GroupV1Update = {
  avatarUpdated?: boolean;
  joined?: Array<string>;
  left?: string | 'You';
  name?: string;
};

export type MessageReactionType = {
  emoji: undefined | string;
  fromId: string;
  targetAuthorUuid: string;
  targetTimestamp: number;
  timestamp: number;
  isSentByConversationId?: Record<string, boolean>;
};

export type MessageAttributesType = {
  bodyAttachment?: AttachmentType;
  bodyRanges?: BodyRangesType;
  callHistoryDetails?: CallHistoryDetailsFromDiskType;
  canReplyToStory?: boolean;
  changedId?: string;
  dataMessage?: Uint8Array | null;
  decrypted_at?: number;
  deletedForEveryone?: boolean;
  deletedForEveryoneTimestamp?: number;
  errors?: Array<CustomError>;
  expirationStartTimestamp?: number | null;
  expireTimer?: number;
  groupMigration?: GroupMigrationType;
  group_update?: GroupV1Update;
  hasAttachments?: boolean | 0 | 1;
  hasFileAttachments?: boolean | 0 | 1;
  hasVisualMediaAttachments?: boolean | 0 | 1;
  isErased?: boolean;
  isTapToViewInvalid?: boolean;
  isViewOnce?: boolean;
  key_changed?: string;
  local?: boolean;
  logger?: unknown;
  message?: unknown;
  messageTimer?: unknown;
  profileChange?: ProfileNameChangeType;
  quote?: QuotedMessageType;
  reactions?: Array<MessageReactionType>;
  requiredProtocolVersion?: number;
  retryOptions?: RetryOptions;
  sourceDevice?: number;
  storyDistributionListId?: string;
  storyId?: string;
  storyReplyContext?: StoryReplyContextType;
  supportedVersionAtReceive?: unknown;
  synced?: boolean;
  unidentifiedDeliveryReceived?: boolean;
  verified?: boolean;
  verifiedChanged?: string;

  id: string;
  type:
    | 'call-history'
    | 'chat-session-refreshed'
    | 'delivery-issue'
    | 'group'
    | 'group-v1-migration'
    | 'group-v2-change'
    | 'incoming'
    | 'keychange'
    | 'outgoing'
    | 'profile-change'
    | 'story'
    | 'timer-notification'
    | 'universal-timer-notification'
    | 'change-number-notification'
    | 'verified-change';
  body?: string;
  attachments?: Array<AttachmentType>;
  preview?: Array<LinkPreviewType>;
  sticker?: StickerType;
  sent_at: number;
  unidentifiedDeliveries?: Array<string>;
  contact?: Array<EmbeddedContactType>;
  conversationId: string;
  storyReactionEmoji?: string;
  giftBadge?: {
    expiration: number;
    level: number;
    id: string | undefined;
    receiptCredentialPresentation: string;
    state: GiftBadgeStates;
  };

  expirationTimerUpdate?: {
    expireTimer: number;
    fromSync?: unknown;
    source?: string;
    sourceUuid?: string;
  };
  // Legacy fields for timer update notification only
  flags?: number;
  groupV2Change?: GroupV2ChangeType;
  // Required. Used to sort messages in the database for the conversation timeline.
  received_at: number;
  received_at_ms?: number;
  // More of a legacy feature, needed as we were updating the schema of messages in the
  //   background, when we were still in IndexedDB, before attachments had gone to disk
  // We set this so that the idle message upgrade process doesn't pick this message up
  schemaVersion?: number;
  // migrateMessageData will increment this field on every failure and give up
  // when the value is too high.
  schemaMigrationAttempts?: number;
  // This should always be set for new messages, but older messages may not have them. We
  //   may not have these for outbound messages, either, as we have not needed them.
  serverGuid?: string;
  serverTimestamp?: number;
  source?: string;
  sourceUuid?: UUIDStringType;

  timestamp: number;

  // Backwards-compatibility with prerelease data schema
  invitedGV2Members?: Array<GroupV2PendingMemberType>;
  droppedGV2MemberIds?: Array<string>;

  sendHQImages?: boolean;

  // Should only be present for incoming messages and errors
  readStatus?: ReadStatus;
  // Used for all kinds of notifications, as well as incoming messages
  seenStatus?: SeenStatus;

  // Should only be present for outgoing messages
  sendStateByConversationId?: SendStateByConversationId;

  // Should only be present for messages deleted for everyone
  deletedForEveryoneSendStatus?: Record<string, boolean>;
  deletedForEveryoneFailed?: boolean;
};

export type ConversationAttributesTypeType = 'private' | 'group';

export type ConversationLastProfileType = Readonly<{
  profileKey: string;
  profileKeyVersion: string;
}>;

export type ValidateConversationType = Pick<
  ConversationAttributesType,
  'e164' | 'uuid' | 'type' | 'groupId'
>;

export type ConversationAttributesType = {
  accessKey?: string | null;
  addedBy?: string;
  badges?: Array<
    | { id: string }
    | {
        id: string;
        expiresAt: number;
        isVisible: boolean;
      }
  >;
  capabilities?: CapabilitiesType;
  color?: string;
  conversationColor?: ConversationColorType;
  customColor?: CustomColorType;
  customColorId?: string;
  discoveredUnregisteredAt?: number;
  draftChanged?: boolean;
  draftAttachments?: Array<AttachmentDraftType>;
  draftBodyRanges?: Array<BodyRangeType>;
  draftTimestamp?: number | null;
  hideStory?: boolean;
  inbox_position?: number;
  isPinned?: boolean;
  lastMessageDeletedForEveryone?: boolean;
  lastMessageStatus?: LastMessageStatus | null;
  markedUnread?: boolean;
  messageCount?: number;
  messageCountBeforeMessageRequests?: number | null;
  messageRequestResponseType?: number;
  muteExpiresAt?: number;
  dontNotifyForMentionsIfMuted?: boolean;
  profileAvatar?: null | {
    hash: string;
    path: string;
  };
  profileKeyCredential?: string | null;
  profileKeyCredentialExpiration?: number | null;
  pniCredential?: string | null;
  lastProfile?: ConversationLastProfileType;
  quotedMessageId?: string | null;
  sealedSender?: unknown;
  sentMessageCount?: number;
  sharedGroupNames?: Array<string>;

  id: string;
  type: ConversationAttributesTypeType;
  timestamp?: number | null;

  // Shared fields
  active_at?: number | null;
  draft?: string | null;
  hasPostedStory?: boolean;
  isArchived?: boolean;
  lastMessage?: string | null;
  name?: string;
  needsStorageServiceSync?: boolean;
  needsVerification?: boolean;
  profileSharing?: boolean;
  storageID?: string;
  storageVersion?: number;
  storageUnknownFields?: string;
  unreadCount?: number;
  version: number;

  // Private core info
  uuid?: UUIDStringType;
  pni?: UUIDStringType;
  e164?: string;

  // Private other fields
  about?: string;
  aboutEmoji?: string;
  profileFamilyName?: string;
  profileKey?: string;
  profileName?: string;
  verified?: number;
  profileLastFetchedAt?: number;
  pendingUniversalTimer?: string;
  username?: string;

  // Group-only
  groupId?: string;
  // A shorthand, representing whether the user is part of the group. Not strictly for
  //   when the user manually left the group. But historically, that was the only way
  //   to leave a group.
  left?: boolean;
  groupVersion?: number;
  isGroupStorySendReady?: boolean;

  // GroupV1 only
  members?: Array<string>;
  derivedGroupV2Id?: string;

  // GroupV2 core info
  masterKey?: string;
  secretParams?: string;
  publicParams?: string;
  revision?: number;
  senderKeyInfo?: SenderKeyInfoType;

  // GroupV2 other fields
  accessControl?: {
    attributes: AccessRequiredEnum;
    members: AccessRequiredEnum;
    addFromInviteLink: AccessRequiredEnum;
  };
  announcementsOnly?: boolean;
  avatar?: {
    url: string;
    path: string;
    hash?: string;
  } | null;
  avatars?: Array<AvatarDataType>;
  description?: string;
  expireTimer?: number;
  membersV2?: Array<GroupV2MemberType>;
  pendingMembersV2?: Array<GroupV2PendingMemberType>;
  pendingAdminApprovalV2?: Array<GroupV2PendingAdminApprovalType>;
  bannedMembersV2?: Array<GroupV2BannedMemberType>;
  groupInviteLinkPassword?: string;
  previousGroupV1Id?: string;
  previousGroupV1Members?: Array<string>;
  acknowledgedGroupNameCollisions?: GroupNameCollisionsWithIdsByTitle;

  // Used only when user is waiting for approval to join via link
  isTemporary?: boolean;
  temporaryMemberCount?: number;

  // Avatars are blurred for some unapproved conversations, but users can manually unblur
  //   them. If the avatar was unblurred and then changed, we don't update this value so
  //   the new avatar gets blurred.
  //
  // This value is useless once the message request has been approved. We don't clean it
  //   up but could. We don't persist it but could (though we'd probably want to clean it
  //   up in that case).
  unblurredAvatarPath?: string;
};

export type GroupV2MemberType = {
  uuid: UUIDStringType;
  role: MemberRoleEnum;
  joinedAtVersion: number;

  // Note that these are temporary flags, generated by applyGroupChange, but eliminated
  //   by applyGroupState. They are used to make our diff-generation more intelligent but
  //   not after that.
  joinedFromLink?: boolean;
  approvedByAdmin?: boolean;
};

export type GroupV2PendingMemberType = {
  addedByUserId?: UUIDStringType;
  uuid: UUIDStringType;
  timestamp: number;
  role: MemberRoleEnum;
};

export type GroupV2BannedMemberType = {
  uuid: UUIDStringType;
  timestamp: number;
};

export type GroupV2PendingAdminApprovalType = {
  uuid: UUIDStringType;
  timestamp: number;
};

export type VerificationOptions = {
  key?: null | Uint8Array;
  viaStorageServiceSync?: boolean;
};

export type ShallowChallengeError = CustomError & {
  readonly retryAfter: number;
  readonly data: SendMessageChallengeData;
};

export declare class ConversationModelCollectionType extends Backbone.Collection<ConversationModel> {
  resetLookups(): void;
}

export declare class MessageModelCollectionType extends Backbone.Collection<MessageModel> {}

export type ReactionAttributesType = {
  emoji: string;
  remove?: boolean;
  targetAuthorUuid: string;
  targetTimestamp: number;
  fromId: string;
  timestamp: number;
  source: ReactionSource;
};
