import * as Backbone from 'backbone';
import { ColorType, LocalizerType } from './types/Util';
import { SendOptionsType } from './textsecure/SendMessage';
import { ConversationType } from './state/ducks/conversations';
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
  needsVerification?: boolean;
  profileFamilyName?: string | null;
  profileKey?: string | null;
  profileName?: string | null;
  profileSharing: boolean;
  storageID?: string;
  type: ConversationTypeType;
  unreadCount?: number;
  verified?: number;
  version: number;
};

declare class ConversationModelType extends Backbone.Model<
  ConversationAttributesType
> {
  id: string;
  cachedProps: ConversationType;
  initialPromise: Promise<any>;

  applyMessageRequestResponse(
    response: number,
    options?: { fromSync: boolean }
  ): void;
  cleanup(): Promise<void>;
  disableProfileSharing(): void;
  getAccepted(): boolean;
  getAvatarPath(): string | undefined;
  getColor(): ColorType | undefined;
  getIsAddedByContact(): boolean;
  getName(): string | undefined;
  getNumber(): string;
  getProfileName(): string | undefined;
  getProfiles(): Promise<Array<Promise<void>>>;
  getRecipients: () => Array<string>;
  getSendOptions(options?: any): SendOptionsType | undefined;
  getTitle(): string;
  idForLogging(): string;
  isVerified(): boolean;
  safeGetVerified(): Promise<number>;
  setProfileKey(profileKey?: string | null): Promise<void>;
  toggleVerified(): Promise<TaskResultType>;
  unblock(): boolean | undefined;
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
