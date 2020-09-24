import * as Backbone from 'backbone';

import { GroupV2ChangeType } from './groups';
import { LocalizerType } from './types/Util';
import { CallHistoryDetailsType } from './types/Calling';
import { ColorType } from './types/Colors';
import { ConversationType } from './state/ducks/conversations';
import { SendOptionsType } from './textsecure/SendMessage';
import { SyncMessageClass } from './textsecure.d';

interface ModelAttributesInterface {
  [key: string]: any;
}

type DeletesAttributesType = {
  fromId: string;
  serverTimestamp: number;
  targetSentTimestamp: number;
};

export declare class DeletesModelType extends Backbone.Model<
  DeletesAttributesType
> {
  forMessage(message: MessageModelType): Array<DeletesModelType>;
  onDelete(doe: DeletesAttributesType): Promise<void>;
}

type TaskResultType = any;

export type MessageAttributesType = {
  id: string;
  type?: string;

  expirationTimerUpdate?: {
    expireTimer: number;
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
  sourceUuid?: string;
};

export declare class MessageModelType extends Backbone.Model<
  MessageAttributesType
> {
  id: string;

  static updateTimers(): void;

  getContact(): ConversationModelType | undefined | null;
  getConversation(): ConversationModelType | undefined | null;
  getPropsForSearchResult(): any;
  getPropsForBubble(): any;
  cleanup(): Promise<void>;
  handleDeleteForEveryone(
    doe: DeletesModelType,
    shouldPersist: boolean
  ): Promise<void>;
}

export type ConversationTypeType = 'private' | 'group';

export type ConversationAttributesType = {
  id: string;
  type: ConversationTypeType;
  timestamp: number;

  // Shared fields
  active_at?: number | null;
  draft?: string;
  isArchived?: boolean;
  lastMessage?: string;
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
  profileFamilyName?: string | null;
  profileKey?: string | null;
  profileName?: string | null;
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
  };
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

type VerificationOptions = {
  key?: null | ArrayBuffer;
  viaContactSync?: boolean;
  viaStorageServiceSync?: boolean;
  viaSyncMessage?: boolean;
};

export declare class ConversationModelType extends Backbone.Model<
  ConversationAttributesType
> {
  id: string;
  cachedProps: ConversationType;
  initialPromise: Promise<any>;
  messageRequestEnum: typeof SyncMessageClass.MessageRequestResponse.Type;

  addCallHistory(details: CallHistoryDetailsType): void;
  applyMessageRequestResponse(
    response: number,
    options?: { fromSync: boolean; viaStorageServiceSync?: boolean }
  ): void;
  cleanup(): Promise<void>;
  disableProfileSharing(options?: { viaStorageServiceSync?: boolean }): void;
  dropProfileKey(): Promise<void>;
  enableProfileSharing(options?: { viaStorageServiceSync?: boolean }): void;
  generateProps(): void;
  getAccepted(): boolean;
  getAvatarPath(): string | undefined;
  getColor(): ColorType | undefined;
  getName(): string | undefined;
  getNumber(): string;
  getProfileName(): string | undefined;
  getProfiles(): Promise<Array<Promise<void>>>;
  getRecipients: () => Array<string>;
  getSendOptions(options?: any): SendOptionsType | undefined;
  getTitle(): string;
  idForLogging(): string;
  debugID(): string;
  isFromOrAddedByTrustedContact(): boolean;
  isBlocked(): boolean;
  isMe(): boolean;
  isMuted(): boolean;
  isPrivate(): boolean;
  isVerified(): boolean;
  maybeRepairGroupV2(data: {
    masterKey: string;
    secretParams: string;
    publicParams: string;
  }): void;
  queueJob(job: () => Promise<void>): Promise<void>;
  safeGetVerified(): Promise<number>;
  setArchived(isArchived: boolean): void;
  setProfileKey(
    profileKey?: string | null,
    options?: { viaStorageServiceSync?: boolean }
  ): Promise<void>;
  setProfileAvatar(avatarPath: string): Promise<void>;
  setUnverified(options: VerificationOptions): Promise<TaskResultType>;
  setVerified(options: VerificationOptions): Promise<TaskResultType>;
  setVerifiedDefault(options: VerificationOptions): Promise<TaskResultType>;
  toggleVerified(): Promise<TaskResultType>;
  block(options?: { viaStorageServiceSync?: boolean }): void;
  unblock(options?: { viaStorageServiceSync?: boolean }): boolean;
  updateE164: (e164?: string) => void;
  updateLastMessage: () => Promise<void>;
  updateUuid: (uuid?: string) => void;
  wrapSend: (sendPromise: Promise<any>) => Promise<any>;
}

export declare class ConversationModelCollectionType extends Backbone.Collection<
  ConversationModelType
> {
  resetLookups(): void;
}

declare class MessageModelCollectionType extends Backbone.Collection<
  MessageModelType
> {}
