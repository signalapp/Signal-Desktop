// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Backbone from 'backbone';
import type { ReadonlyDeep } from 'type-fest';

import type { GroupV2ChangeType } from './groups';
import type { DraftBodyRanges, RawBodyRange } from './types/BodyRange';
import type { CustomColorType, ConversationColorType } from './types/Colors';
import type { SendMessageChallengeData } from './textsecure/Errors';
import type { ConversationModel } from './models/conversations';
import type { ProfileNameChangeType } from './util/getStringForProfileChange';
import type { CapabilitiesType } from './textsecure/WebAPI';
import type { ReadStatus } from './messages/MessageReadStatus';
import type { SendStateByConversationId } from './messages/MessageSendState';
import type { GroupNameCollisionsWithIdsByTitle } from './util/groupMemberNameCollisions';

import type {
  AttachmentDraftType,
  AttachmentType,
  ThumbnailType,
} from './types/Attachment';
import type { EmbeddedContactType } from './types/EmbeddedContact';
import { SignalService as Proto } from './protobuf';
import type { AvatarDataType, ContactAvatarType } from './types/Avatar';
import type { AciString, PniString, ServiceIdString } from './types/ServiceId';
import type { StoryDistributionIdString } from './types/StoryDistributionId';
import type { SeenStatus } from './MessageSeenStatus';
import type { GiftBadgeStates } from './components/conversation/Message';
import type { LinkPreviewType } from './types/message/LinkPreviews';

import type { StickerType } from './types/Stickers';
import type { StorySendMode } from './types/Stories';
import type { MIMEType } from './types/MIME';
import type { DurationInSeconds } from './util/durations';
import type { AnyPaymentEvent } from './types/Payment';

import AccessRequiredEnum = Proto.AccessControl.AccessRequired;
import MemberRoleEnum = Proto.Member.Role;
import type { MessageRequestResponseEvent } from './types/MessageRequestResponseEvent';
import type { QuotedMessageForComposerType } from './state/ducks/composer';

export type LastMessageStatus =
  | 'paused'
  | 'error'
  | 'partial-sent'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'viewed';

export type SenderKeyDeviceType = {
  id: number;
  serviceId: ServiceIdString;
  registrationId: number;
};

export type SenderKeyInfoType = {
  createdAtDate: number;
  distributionId: string;
  memberDevices: Array<SenderKeyDeviceType>;
};

export type CustomError = Error & {
  serviceId?: ServiceIdString;
  number?: string;
  data?: object;
  retryAfter?: number;
};

export type GroupMigrationType = {
  areWeInvited: boolean;
  droppedMemberIds?: ReadonlyArray<string>;
  invitedMembers?: ReadonlyArray<LegacyMigrationPendingMemberType>;

  // We don't generate data like this; these were added to support import/export
  droppedMemberCount?: number;
  invitedMemberCount?: number;
};

export type QuotedAttachmentType = {
  contentType: MIMEType;
  fileName?: string;
  thumbnail?: ThumbnailType;
};

export type QuotedMessageType = {
  attachments: ReadonlyArray<QuotedAttachmentType>;
  payment?: AnyPaymentEvent;
  // `author` is an old attribute that holds the author's E164. We shouldn't use it for
  //   new messages, but old messages might have this attribute.
  author?: string;
  authorAci?: AciString;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
  // id can be null if the referenced message was not found and we imported this quote
  // from backup
  id: number | null;
  isGiftBadge?: boolean;
  isViewOnce: boolean;
  referencedMessageNotFound: boolean;
  text?: string;
  /** @deprecated `messageId` is used only in composer state, but still may exist in DB
   * records, particularly for messages sent from this device */
  messageId?: string;
};

type StoryReplyContextType = {
  attachment?: AttachmentType;
  authorAci?: AciString;
  messageId: string;
};

export type GroupV1Update = {
  avatarUpdated?: boolean;
  joined?: ReadonlyArray<string>;
  left?: string | 'You';
  name?: string;
};

export type MessageReactionType = {
  emoji: undefined | string;
  fromId: string;
  targetTimestamp: number;
  timestamp: number;
  isSentByConversationId?: Record<string, boolean>;
};

// Note: when adding to the set of things that can change via edits, sendNormalMessage.ts
//   needs more usage of get/setPropForTimestamp. Also, these fields must match the fields
//   in MessageAttributesType.
export type EditHistoryType = {
  attachments?: ReadonlyArray<AttachmentType>;
  body?: string;
  bodyAttachment?: AttachmentType;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
  preview?: ReadonlyArray<LinkPreviewType>;
  quote?: QuotedMessageType;
  sendStateByConversationId?: SendStateByConversationId;
  timestamp: number;
  received_at: number;
  received_at_ms?: number;
  serverTimestamp?: number;
  readStatus?: ReadStatus;
  unidentifiedDeliveryReceived?: boolean;
};

type MessageType =
  | 'call-history'
  | 'change-number-notification'
  | 'chat-session-refreshed'
  | 'conversation-merge'
  | 'delivery-issue'
  | 'group-v1-migration'
  | 'group-v2-change'
  | 'group'
  | 'incoming'
  | 'joined-signal-notification'
  | 'keychange'
  | 'outgoing'
  | 'phone-number-discovery'
  | 'profile-change'
  | 'story'
  | 'timer-notification'
  | 'universal-timer-notification'
  | 'contact-removed-notification'
  | 'title-transition-notification'
  | 'verified-change'
  | 'message-request-response-event';

// Note: when adding a property that is likely to be set across many messages,
//   consider adding a database column as well and updating `MESSAGE_COLUMNS`
//   in `ts/sql/Server.ts`
export type MessageAttributesType = {
  bodyAttachment?: AttachmentType;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
  callId?: string;
  canReplyToStory?: boolean;
  changedId?: string;
  dataMessage?: Uint8Array | null;
  decrypted_at?: number;
  deletedForEveryone?: boolean;
  deletedForEveryoneTimestamp?: number;
  errors?: ReadonlyArray<CustomError>;
  expirationStartTimestamp?: number | null;
  expireTimer?: DurationInSeconds;
  groupMigration?: GroupMigrationType;
  group_update?: GroupV1Update;
  hasAttachments?: boolean | 0 | 1;
  hasFileAttachments?: boolean | 0 | 1;
  hasVisualMediaAttachments?: boolean | 0 | 1;
  mentionsMe?: boolean | 0 | 1;
  isErased?: boolean;
  isTapToViewInvalid?: boolean;
  isViewOnce?: boolean;
  editHistory?: ReadonlyArray<EditHistoryType>;
  editMessageTimestamp?: number;
  editMessageReceivedAt?: number;
  editMessageReceivedAtMs?: number;
  key_changed?: string;
  local?: boolean;
  logger?: unknown;
  message?: unknown;
  messageTimer?: unknown;
  messageRequestResponseEvent?: MessageRequestResponseEvent;
  profileChange?: ProfileNameChangeType;
  payment?: AnyPaymentEvent;
  quote?: QuotedMessageType;
  reactions?: ReadonlyArray<MessageReactionType>;
  requiredProtocolVersion?: number;
  sms?: boolean;
  sourceDevice?: number;
  storyDistributionListId?: StoryDistributionIdString;
  storyId?: string;
  storyReplyContext?: StoryReplyContextType;
  storyRecipientsVersion?: number;
  supportedVersionAtReceive?: unknown;
  synced?: boolean;
  unidentifiedDeliveryReceived?: boolean;
  verified?: boolean;
  verifiedChanged?: string;

  id: string;
  type: MessageType;
  body?: string;
  attachments?: ReadonlyArray<AttachmentType>;
  preview?: ReadonlyArray<LinkPreviewType>;
  sticker?: StickerType;
  sent_at: number;
  unidentifiedDeliveries?: ReadonlyArray<string>;
  contact?: ReadonlyArray<EmbeddedContactType>;
  conversationId: string;
  storyReaction?: {
    emoji: string;
    targetAuthorAci: AciString;
    targetTimestamp: number;
  };
  giftBadge?:
    | {
        state:
          | GiftBadgeStates.Unopened
          | GiftBadgeStates.Opened
          | GiftBadgeStates.Redeemed;
        expiration: number;
        level: number;
        id: string | undefined;
        receiptCredentialPresentation: string;
      }
    | {
        state: GiftBadgeStates.Failed;
      };

  expirationTimerUpdate?: {
    expireTimer?: DurationInSeconds;
    fromSync?: unknown;
    source?: string;
    sourceServiceId?: ServiceIdString;
  };
  phoneNumberDiscovery?: {
    e164: string;
  };
  conversationMerge?: {
    renderInfo: ConversationRenderInfoType;
  };
  titleTransition?: {
    renderInfo: ConversationRenderInfoType;
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
  sourceServiceId?: ServiceIdString;

  timestamp: number;

  // Backwards-compatibility with prerelease data schema
  invitedGV2Members?: ReadonlyArray<LegacyMigrationPendingMemberType>;
  droppedGV2MemberIds?: ReadonlyArray<string>;

  sendHQImages?: boolean;

  // Should only be present for incoming messages and errors
  readAt?: number;
  readStatus?: ReadStatus;
  // Used for all kinds of notifications, as well as incoming messages
  seenStatus?: SeenStatus;

  // Should only be present for outgoing messages
  sendStateByConversationId?: SendStateByConversationId;

  // Should only be present for messages deleted for everyone
  deletedForEveryoneSendStatus?: Record<string, boolean>;
  deletedForEveryoneFailed?: boolean;
};

export type ReadonlyMessageAttributesType = ReadonlyDeep<MessageAttributesType>;

export type ConversationAttributesTypeType = 'private' | 'group';

export type ConversationLastProfileType = Readonly<{
  profileKey: string;
  profileKeyVersion: string;
}>;

export type ValidateConversationType = Pick<
  ConversationAttributesType,
  'e164' | 'serviceId' | 'type' | 'groupId'
>;

export type DraftEditMessageType = {
  editHistoryLength: number;
  attachmentThumbnail?: string;
  bodyRanges?: DraftBodyRanges;
  body: string;
  preview?: LinkPreviewType;
  targetMessageId: string;
  quote?: QuotedMessageForComposerType['quote'];
};

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

  // Set at backup import time, exported as is.
  wallpaperPhotoPointerBase64?: string;
  wallpaperPreset?: number;
  dimWallpaperInDarkMode?: boolean;
  autoBubbleColor?: boolean;

  discoveredUnregisteredAt?: number;
  firstUnregisteredAt?: number;
  draftChanged?: boolean;
  draftAttachments?: ReadonlyArray<AttachmentDraftType>;
  draftBodyRanges?: DraftBodyRanges;
  draftTimestamp?: number | null;
  hideStory?: boolean;
  inbox_position?: number;
  // When contact is removed - it is initially placed into `justNotification`
  // removal stage. In this stage user can still send messages (which will
  // set `removalStage` to `undefined`), but if a new incoming message arrives -
  // the stage will progress to `messageRequest` and composition area will be
  // replaced with a message request.
  removalStage?: 'justNotification' | 'messageRequest';
  isPinned?: boolean;
  lastMessageDeletedForEveryone?: boolean;
  lastMessage?: string | null;
  lastMessageBodyRanges?: ReadonlyArray<RawBodyRange>;
  lastMessagePrefix?: string;
  lastMessageAuthor?: string | null;
  lastMessageStatus?: LastMessageStatus | null;
  lastMessageReceivedAt?: number;
  lastMessageReceivedAtMs?: number;
  markedUnread?: boolean;
  messageCount?: number;
  messageCountBeforeMessageRequests?: number | null;
  messageRequestResponseType?: number;
  messagesDeleted?: boolean;
  muteExpiresAt?: number;
  dontNotifyForMentionsIfMuted?: boolean;
  sharingPhoneNumber?: boolean;
  profileAvatar?: ContactAvatarType | null;
  profileKeyCredential?: string | null;
  profileKeyCredentialExpiration?: number | null;
  lastProfile?: ConversationLastProfileType;
  needsTitleTransition?: boolean;
  quotedMessageId?: string | null;
  /**
   * TODO: Rename this key to be specific to the accessKey on the conversation
   * It's not used for group endorsements.
   */
  sealedSender?: unknown;
  sentMessageCount?: number;
  sharedGroupNames?: ReadonlyArray<string>;
  voiceNotePlaybackRate?: number;

  id: string;
  type: ConversationAttributesTypeType;
  timestamp?: number | null;

  // Shared fields
  active_at?: number | null;
  draft?: string | null;
  draftEditMessage?: DraftEditMessageType;
  hasPostedStory?: boolean;
  isArchived?: boolean;
  isReported?: boolean;
  name?: string;
  systemGivenName?: string;
  systemFamilyName?: string;
  systemNickname?: string;
  nicknameGivenName?: string | null;
  nicknameFamilyName?: string | null;
  note?: string | null;
  needsStorageServiceSync?: boolean;
  needsVerification?: boolean;
  profileSharing?: boolean;
  storageID?: string;
  storageVersion?: number;
  storageUnknownFields?: string;
  unreadCount?: number;
  unreadMentionsCount?: number;
  version: number;

  // Private core info
  serviceId?: ServiceIdString;
  pni?: PniString;
  pniSignatureVerified?: boolean;
  e164?: string;

  // Private other fields
  about?: string;
  aboutEmoji?: string;
  profileFamilyName?: string;
  profileKey?: string;
  profileName?: string;
  verified?: number;
  profileLastUpdatedAt?: number;
  profileLastFetchedAt?: number;
  pendingUniversalTimer?: string;
  pendingRemovedContactNotification?: string;
  username?: string;
  shareMyPhoneNumber?: boolean;
  previousIdentityKey?: string;
  reportingToken?: string;

  // Group-only
  groupId?: string;
  // A shorthand, representing whether the user is part of the group. Not strictly for
  //   when the user manually left the group. But historically, that was the only way
  //   to leave a group.
  left?: boolean;
  groupVersion?: number;
  storySendMode?: StorySendMode;

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
  avatar?: ContactAvatarType | null;
  avatars?: ReadonlyArray<Readonly<AvatarDataType>>;
  description?: string;
  expireTimer?: DurationInSeconds;
  expireTimerVersion: number;
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
  unblurredAvatarUrl?: string;

  // Legacy field, mapped to above in getConversation()
  unblurredAvatarPath?: string;

  // Only used during backup integration tests. After import, our data model merges
  // Contact and Chat frames from a backup, and we will then by default export both, even
  // if the Chat frame was not imported. That's fine in normal usage, but breaks
  // integration tests that aren't expecting to see a Chat frame on export that was not
  // there on import.
  test_chatFrameImportedFromBackup?: boolean;
};

export type ConversationRenderInfoType = Pick<
  ConversationAttributesType,
  | 'e164'
  | 'name'
  | 'profileFamilyName'
  | 'profileName'
  | 'systemGivenName'
  | 'systemFamilyName'
  | 'systemNickname'
  | 'nicknameGivenName'
  | 'nicknameFamilyName'
  | 'type'
  | 'username'
>;

export type GroupV2MemberType = {
  aci: AciString;
  role: MemberRoleEnum;
  joinedAtVersion: number;

  // Note that these are temporary flags, generated by applyGroupChange, but eliminated
  //   by applyGroupState. They are used to make our diff-generation more intelligent but
  //   not after that.
  joinedFromLink?: boolean;
  approvedByAdmin?: boolean;
};

export type LegacyMigrationPendingMemberType = {
  addedByUserId?: string;
  uuid: string;
  timestamp: number;
  role: MemberRoleEnum;
};

export type GroupV2PendingMemberType = {
  addedByUserId: AciString;
  serviceId: ServiceIdString;
  timestamp: number;
  role: MemberRoleEnum;
};

export type GroupV2BannedMemberType = {
  serviceId: ServiceIdString;
  timestamp: number;
};

export type GroupV2PendingAdminApprovalType = {
  aci: AciString;
  timestamp: number;
};

export type ShallowChallengeError = CustomError & {
  readonly retryAfter: number;
  readonly data: SendMessageChallengeData;
};

export declare class ConversationModelCollectionType extends Backbone.Collection<ConversationModel> {
  resetLookups(): void;
}
