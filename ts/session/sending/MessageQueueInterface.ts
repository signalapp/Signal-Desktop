import { ContentMessage, OpenGroupMessage } from '../messages/outgoing';
import { RawMessage } from '../types/RawMessage';
import { TypedEventEmitter } from '../utils';
import { PubKey } from '../types';
import { ClosedGroupV2Message } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2Message';
import { ClosedGroupV2ChatMessage } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2ChatMessage';

export type GroupMessageType =
  | OpenGroupMessage
  | ClosedGroupV2ChatMessage
  | ClosedGroupV2Message;
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
  sendSyncMessage(message: any): Promise<void>;
  processPending(device: PubKey): Promise<void>;
}
