import {
  ClosedGroupMessage,
  ContentMessage,
  OpenGroupMessage,
  SyncMessage,
} from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';
import { PubKey } from '../types';

type GroupMessageType = OpenGroupMessage | ClosedGroupMessage;

export interface MessageQueueInterfaceEvents {
  success: (
    message: RawMessage | OpenGroupMessage,
    wrappedEnvelope?: Uint8Array
  ) => void;
  fail: (message: RawMessage | OpenGroupMessage, error: Error) => void;
}

export interface MessageQueueInterface {
  events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  sendUsingMultiDevice(user: PubKey, message: ContentMessage): Promise<void>;
  send(device: PubKey, message: ContentMessage): Promise<void>;
  sendToGroup(message: GroupMessageType): Promise<void>;
  sendSyncMessage(message: SyncMessage | undefined): Promise<void>;
  processPending(device: PubKey): Promise<void>;
}
