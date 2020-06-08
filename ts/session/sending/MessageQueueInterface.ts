import {
  ClosedGroupMessage,
  ContentMessage,
  OpenGroupMessage,
} from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';
import { PubKey } from '../types';

type GroupMessageType = OpenGroupMessage | ClosedGroupMessage;

export interface MessageQueueInterfaceEvents {
  success: (message: RawMessage) => void;
  fail: (message: RawMessage, error: Error) => void;
}

export interface MessageQueueInterface {
  events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  sendUsingMultiDevice(user: PubKey, message: ContentMessage): void;
  send(device: PubKey, message: ContentMessage): void;
  sendToGroup(message: GroupMessageType): void;
  sendSyncMessage(message: ContentMessage): void;
}
