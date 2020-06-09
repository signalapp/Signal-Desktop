import {
  ContentMessage,
  OpenGroupMessage,
} from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';
import { ClosedGroupMessage } from '../messages/outgoing/content/data/group';

type GroupMessageType = OpenGroupMessage | ClosedGroupMessage;

export interface MessageQueueInterfaceEvents {
  success: (message: RawMessage) => void;
  fail: (message: RawMessage, error: Error) => void;
}

export interface MessageQueueInterface {
  events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  sendUsingMultiDevice(user: string, message: ContentMessage): void;
  send(device: string, message: ContentMessage): void;
  sendToGroup(message: GroupMessageType): void;
  sendSyncMessage(message: ContentMessage): void;
}
