import * as Backbone from 'backbone';

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

declare class DeletesModelType extends Backbone.Model<DeletesAttributesType> {
  forMessage(message: MessageModelType): Array<DeletesModelType>;
  onDelete(doe: DeletesAttributesType): Promise<void>;
}

type TaskResultType = any;

type MessageAttributesType = {
  id: string;
  serverTimestamp: number;
};

declare class MessageModelType extends Backbone.Model<MessageAttributesType> {
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

type ConversationTypeType = 'private' | 'group';

type ConversationAttributesType = {
  id: string;
  uuid?: string;
  e164?: string;

  active_at?: number | null;
  draft?: string;
  groupId?: string;
  isArchived?: boolean;
  lastMessage?: string;
  members?: Array<string>;
  needsStorageServiceSync?: boolean;
  needsVerification?: boolean;
  profileFamilyName?: string | null;
  profileKey?: string | null;
  profileName?: string | null;
  profileSharing: boolean;
  storageID?: string;
  storageUnknownFields: string;
  type: ConversationTypeType;
  unreadCount?: number;
  verified?: number;
  version: number;
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
  isFromOrAddedByTrustedContact(): boolean;
  isBlocked(): boolean;
  isMe(): boolean;
  isPrivate(): boolean;
  isVerified(): boolean;
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

declare class ConversationModelCollectionType extends Backbone.Collection<
  ConversationModelType
> {
  resetLookups(): void;
}

declare class MessageModelCollectionType extends Backbone.Collection<
  MessageModelType
> {}
