import * as Backbone from 'backbone';

import { GroupV2ChangeType } from './groups';
import { LocalizerType, BodyRangesType } from './types/Util';
import { CallHistoryDetailsType } from './types/Calling';
import { ColorType } from './types/Colors';
import {
  ConversationType,
  MessageType,
  LastMessageStatus,
} from './state/ducks/conversations';
import { SendOptionsType } from './textsecure/SendMessage';
import { SyncMessageClass } from './textsecure.d';
import { UserMessage } from './types/Message';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { ProfileNameChangeType } from './util/getStringForProfileChange';

interface ModelAttributesInterface {
  [key: string]: any;
}

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

export interface CustomError extends Error {
  identifier?: string;
  number?: string;
}

export type MessageAttributesType = {
  bodyPending: boolean;
  bodyRanges: BodyRangesType;
  callHistoryDetails: CallHistoryDetailsType;
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
  reactions: Array<{ fromId: string; emoji: unknown; timestamp: unknown }>;
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
  // More of a legacy feature, needed as we were updating the schema of messages in the
  //   background, when we were still in IndexedDB, before attachments had gone to disk
  // We set this so that the idle message upgrade process doesn't pick this message up
  schemaVersion: number;
  serverTimestamp?: number;
  source?: string;
  sourceUuid?: string;

  unread: number;
  timestamp: number;
};

export type ConversationAttributesTypeType = 'private' | 'group';

export type ConversationAttributesType = {
  accessKey: string | null;
  addedBy?: string;
  capabilities: { uuid: string };
  color?: ColorType;
  discoveredUnregisteredAt: number;
  draftAttachments: Array<unknown>;
  draftTimestamp: number | null;
  inbox_position: number;
  isPinned: boolean;
  lastMessageDeletedForEveryone: unknown;
  lastMessageStatus: LastMessageStatus | null;
  messageCount: number;
  messageCountBeforeMessageRequests: number;
  messageRequestResponseType: number;
  muteExpiresAt: number;
  profileAvatar: WhatIsThis;
  profileKeyCredential: string | null;
  profileKeyVersion: string | null;
  quotedMessageId: string;
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
  storageUnknownFields: string;
  unreadCount?: number;
  version: number;

  // Private core info
  uuid?: string;
  e164?: string;

  // Private other fields
  profileFamilyName?: string;
  profileKey?: string;
  profileName?: string;
  storageProfileKey?: string;
  verified?: number;

  // Group-only
  groupId?: string;
  left: boolean;
  groupVersion?: number;

  // GroupV1 only
  members?: Array<string>;

  // GroupV2 core info
  masterKey?: string;
  secretParams?: string;
  publicParams?: string;
  revision?: number;

  // GroupV2 other fields
  accessControl?: {
    attributes: number;
    members: number;
  };
  avatar?: {
    url: string;
    path: string;
    hash: string;
  } | null;
  expireTimer?: number;
  membersV2?: Array<GroupV2MemberType>;
  pendingMembersV2?: Array<GroupV2PendingMemberType>;
};

export type GroupV2MemberType = {
  conversationId: string;
  role: number;
  joinedAtVersion: number;
};
export type GroupV2PendingMemberType = {
  addedByUserId: string;
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
