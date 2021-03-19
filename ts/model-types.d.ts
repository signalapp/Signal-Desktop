// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Backbone from 'backbone';

import { GroupV2ChangeType } from './groups';
import { LocalizerType, BodyRangeType, BodyRangesType } from './types/Util';
import { CallHistoryDetailsFromDiskType } from './types/Calling';
import { ColorType } from './types/Colors';
import {
  ConversationType,
  MessageType,
  LastMessageStatus,
} from './state/ducks/conversations';
import { SendOptionsType } from './textsecure/SendMessage';
import {
  AccessRequiredEnum,
  MemberRoleEnum,
  SyncMessageClass,
} from './textsecure.d';
import { UserMessage } from './types/Message';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { ProfileNameChangeType } from './util/getStringForProfileChange';
import { CapabilitiesType } from './textsecure/WebAPI';

export type WhatIsThis = any;

type DeletesAttributesType = {
  fromId: string;
  serverTimestamp: number;
  targetSentTimestamp: number;
};

export declare class DeletesModelType extends Backbone.Model<
  DeletesAttributesType
> {
  forMessage(message: MessageModel): Array<DeletesModelType>;
  onDelete(doe: DeletesAttributesType): Promise<void>;
}

type TaskResultType = any;

export type CustomError = Error & {
  identifier?: string;
  number?: string;
};

export type GroupMigrationType = {
  areWeInvited: boolean;
  droppedMemberIds: Array<string>;
  invitedMembers: Array<GroupV2PendingMemberType>;
};

export type MessageAttributesType = {
  bodyPending: boolean;
  bodyRanges: BodyRangesType;
  callHistoryDetails: CallHistoryDetailsFromDiskType;
  changedId: string;
  dataMessage: ArrayBuffer | null;
  decrypted_at: number;
  deletedForEveryone: boolean;
  deletedForEveryoneTimestamp?: number;
  delivered: number;
  delivered_to: Array<string | null>;
  errors: Array<CustomError> | null;
  expirationStartTimestamp: number | null;
  expireTimer: number;
  expires_at: number;
  groupMigration?: GroupMigrationType;
  group_update: {
    avatarUpdated: boolean;
    joined: Array<string>;
    left: string | 'You';
    name: string;
  };
  hasAttachments: boolean;
  hasFileAttachments: boolean;
  hasVisualMediaAttachments: boolean;
  isErased: boolean;
  isTapToViewInvalid: boolean;
  isViewOnce: boolean;
  key_changed: string;
  local: boolean;
  logger: unknown;
  message: unknown;
  messageTimer: unknown;
  profileChange: ProfileNameChangeType;
  quote: {
    attachments: Array<typeof window.WhatIsThis>;
    author: string;
    authorUuid: string;
    bodyRanges: BodyRangesType;
    id: string;
    referencedMessageNotFound: boolean;
    text: string;
  } | null;
  reactions: Array<{ fromId: string; emoji: string; timestamp: number }>;
  read_by: Array<string | null>;
  requiredProtocolVersion: number;
  sent: boolean;
  sourceDevice: string | number;
  snippet: unknown;
  supportedVersionAtReceive: unknown;
  synced: boolean;
  unidentifiedDeliveryReceived: boolean;
  verified: boolean;
  verifiedChanged: string;

  id: string;
  type?: string;
  body: string;
  attachments: Array<WhatIsThis>;
  preview: Array<WhatIsThis>;
  sticker: WhatIsThis;
  sent_at: WhatIsThis;
  sent_to: Array<string>;
  unidentifiedDeliveries: Array<string>;
  contact: Array<WhatIsThis>;
  conversationId: string;
  recipients: Array<WhatIsThis>;
  reaction: WhatIsThis;
  destination?: WhatIsThis;
  destinationUuid?: string;

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
  received_at?: number;
  received_at_ms?: number;
  // More of a legacy feature, needed as we were updating the schema of messages in the
  //   background, when we were still in IndexedDB, before attachments had gone to disk
  // We set this so that the idle message upgrade process doesn't pick this message up
  schemaVersion: number;
  serverTimestamp?: number;
  source?: string;
  sourceUuid?: string;

  unread: number;
  timestamp: number;

  // Backwards-compatibility with prerelease data schema
  invitedGV2Members?: Array<GroupV2PendingMemberType>;
  droppedGV2MemberIds?: Array<string>;
};

export type ConversationAttributesTypeType = 'private' | 'group';

export type ConversationAttributesType = {
  accessKey: string | null;
  addedBy?: string;
  capabilities?: CapabilitiesType;
  color?: string;
  discoveredUnregisteredAt?: number;
  draftAttachments: Array<unknown>;
  draftBodyRanges: Array<BodyRangeType>;
  draftTimestamp: number | null;
  inbox_position: number;
  isPinned: boolean;
  lastMessageDeletedForEveryone: boolean;
  lastMessageStatus: LastMessageStatus | null;
  markedUnread: boolean;
  messageCount: number;
  messageCountBeforeMessageRequests: number | null;
  messageRequestResponseType: number;
  muteExpiresAt: number | undefined;
  profileAvatar: WhatIsThis;
  profileKeyCredential: string | null;
  profileKeyVersion: string | null;
  quotedMessageId: string | null;
  sealedSender: unknown;
  sentMessageCount: number;
  sharedGroupNames: Array<string>;

  id: string;
  type: ConversationAttributesTypeType;
  timestamp: number | null;

  // Shared fields
  active_at?: number | null;
  draft?: string | null;
  isArchived?: boolean;
  lastMessage?: string | null;
  name?: string;
  needsStorageServiceSync?: boolean;
  needsVerification?: boolean;
  profileSharing: boolean;
  storageID?: string;
  storageUnknownFields?: string;
  unreadCount?: number;
  version: number;

  // Private core info
  uuid?: string;
  e164?: string;

  // Private other fields
  about?: string;
  aboutEmoji?: string;
  profileFamilyName?: string;
  profileKey?: string;
  profileName?: string;
  verified?: number;
  profileLastFetchedAt?: number;

  // Group-only
  groupId?: string;
  // A shorthand, representing whether the user is part of the group. Not strictly for
  //   when the user manually left the group. But historically, that was the only way
  //   to leave a group.
  left: boolean;
  groupVersion?: number;

  // GroupV1 only
  members?: Array<string>;
  derivedGroupV2Id?: string;

  // GroupV2 core info
  masterKey?: string;
  secretParams?: string;
  publicParams?: string;
  revision?: number;

  // GroupV2 other fields
  accessControl?: {
    attributes: AccessRequiredEnum;
    members: AccessRequiredEnum;
    addFromInviteLink: AccessRequiredEnum;
  };
  avatar?: {
    url: string;
    path: string;
    hash?: string;
  } | null;
  expireTimer?: number;
  membersV2?: Array<GroupV2MemberType>;
  pendingMembersV2?: Array<GroupV2PendingMemberType>;
  pendingAdminApprovalV2?: Array<GroupV2PendingAdminApprovalType>;
  groupInviteLinkPassword?: string;
  previousGroupV1Id?: string;
  previousGroupV1Members?: Array<string>;

  // Used only when user is waiting for approval to join via link
  isTemporary?: boolean;
  temporaryMemberCount?: number;
};

export type GroupV2MemberType = {
  conversationId: string;
  role: MemberRoleEnum;
  joinedAtVersion: number;

  // Note that these are temporary flags, generated by applyGroupChange, but eliminated
  //   by applyGroupState. They are used to make our diff-generation more intelligent but
  //   not after that.
  joinedFromLink?: boolean;
  approvedByAdmin?: boolean;
};

export type GroupV2PendingMemberType = {
  addedByUserId?: string;
  conversationId: string;
  timestamp: number;
  role: MemberRoleEnum;
};

export type GroupV2PendingAdminApprovalType = {
  conversationId: string;
  timestamp: number;
};

export type VerificationOptions = {
  key?: null | ArrayBuffer;
  viaContactSync?: boolean;
  viaStorageServiceSync?: boolean;
  viaSyncMessage?: boolean;
};

export declare class ConversationModelCollectionType extends Backbone.Collection<
  ConversationModel
> {
  resetLookups(): void;
}

export declare class MessageModelCollectionType extends Backbone.Collection<
  MessageModel
> {}
