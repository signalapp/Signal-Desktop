import { OpenGroupMessage, OutgoingContentMessage } from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';

// TODO: add all group messages here, replace OutgoingContentMessage with them
type GroupMessageType = OpenGroupMessage | OutgoingContentMessage;

export interface MessageQueueInterfaceEvents {
  success: (message: RawMessage) => void;
  fail: (message: RawMessage, error: Error) => void;
}

export interface MessageQueueInterface {
  events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  sendUsingMultiDevice(user: string, message: OutgoingContentMessage): void;
  send(device: string, message: OutgoingContentMessage): void;
  sendToGroup(message: GroupMessageType): void;
  sendSyncMessage(message: OutgoingContentMessage): void;
}
