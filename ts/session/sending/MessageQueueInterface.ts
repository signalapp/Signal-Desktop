import {
  ContentMessage,
  ExpirationTimerUpdateMessage,
  OpenGroupMessage,
} from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';
import { PubKey } from '../types';
import { ClosedGroupChatMessage } from '../messages/outgoing/content/data/group/ClosedGroupChatMessage';
import {
  ClosedGroupAddedMembersMessage,
  ClosedGroupEncryptionPairMessage,
  ClosedGroupNameChangeMessage,
  ClosedGroupRemovedMembersMessage,
  ClosedGroupUpdateMessage,
} from '../messages/outgoing/content/data/group';
import { ClosedGroupMemberLeftMessage } from '../messages/outgoing/content/data/group/ClosedGroupMemberLeftMessage';
import { ClosedGroupEncryptionPairRequestMessage } from '../messages/outgoing/content/data/group/ClosedGroupEncryptionPairRequestMessage';

export type GroupMessageType =
  | OpenGroupMessage
  | ClosedGroupChatMessage
  | ClosedGroupAddedMembersMessage
  | ClosedGroupRemovedMembersMessage
  | ClosedGroupNameChangeMessage
  | ClosedGroupMemberLeftMessage
  | ClosedGroupUpdateMessage
  | ClosedGroupEncryptionPairMessage
  | ClosedGroupEncryptionPairRequestMessage;

// ClosedGroupEncryptionPairReplyMessage must be sent to a user pubkey. Not a group.
export interface MessageQueueInterfaceEvents {
  sendSuccess: (
    message: RawMessage | OpenGroupMessage,
    wrappedEnvelope?: Uint8Array
  ) => void;
  sendFail: (message: RawMessage | OpenGroupMessage, error: Error) => void;
}

export interface MessageQueueInterface {
  events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  sendToPubKey(user: PubKey, message: ContentMessage): Promise<void>;
  send(device: PubKey, message: ContentMessage): Promise<void>;
  sendToGroup(
    message: GroupMessageType,
    sentCb?: (message?: RawMessage) => Promise<void>
  ): Promise<void>;
  sendSyncMessage(
    message: any,
    sentCb?: (message?: RawMessage) => Promise<void>
  ): Promise<void>;
  processPending(device: PubKey): Promise<void>;
}
