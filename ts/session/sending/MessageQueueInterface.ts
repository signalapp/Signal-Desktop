import {
  ContentMessage,
  ExpirationTimerUpdateMessage,
  OpenGroupMessage,
} from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';
import { PubKey } from '../types';
import { ClosedGroupMessage } from '../messages/outgoing/content/data/group/ClosedGroupMessage';
import { ClosedGroupChatMessage } from '../messages/outgoing/content/data/group/ClosedGroupChatMessage';

export type GroupMessageType =
  | OpenGroupMessage
  | ClosedGroupChatMessage
  | ClosedGroupMessage
  | ExpirationTimerUpdateMessage;
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
