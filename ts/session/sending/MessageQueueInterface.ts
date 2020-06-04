import { OpenGroupMessage, ContentMessage, SyncMessage } from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';

// TODO: add all group messages here, replace OutgoingContentMessage with them
type GroupMessageType = OpenGroupMessage | ContentMessage;

export interface MessageQueueInterfaceEvents {
  success: (message: RawMessage) => void;
  fail: (message: RawMessage, error: Error) => void;
}

export interface MessageQueueInterface {
  events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  sendUsingMultiDevice(user: string, message: ContentMessage): void;
  send(device: string, message: ContentMessage): void;
  sendToGroup(message: GroupMessageType): void;
  sendSyncMessage(message: SyncMessage): void;
}