import { OpenGroupMessage, OutgoingContentMessage } from '../messages/outgoing';

// TODO: add all group messages here, replace OutgoingContentMessage with them
type GroupMessageType = OpenGroupMessage | OutgoingContentMessage;
export interface MessageQueueInterface {
  sendUsingMultiDevice(user: string, message: OutgoingContentMessage): void;
  send(device: string, message: OutgoingContentMessage): void;
  sendToGroup(message: GroupMessageType): void;
  sendSyncMessage(message: OutgoingContentMessage): void;
  // TODO: Find a good way to handle events in this
  // E.g if we do queue.onMessageSent() we want to also be able to stop listening to the event
  // TODO: implement events here
}
