import * as crypto from 'crypto';
import uuid from 'uuid';

import { RawMessage } from '../types/RawMessage';
import { ChatMessage, ContentMessage } from '../messages/outgoing';
import { EncryptionType } from '../types/EncryptionType';


export function toRawMessage(device: PubKey, message: ContentMessage): RawMessage {
  const ttl = message.ttl();
  const timestamp = message.timestamp;
  const plainTextBuffer = message.plainTextBuffer();

  // Get EncryptionType depending on message type.
  // let encryption: EncryptionType;

  // switch (message.constructor.name) {
  //   case MessageType.Chat:
  //     encryption = EncryptionType.Signal;
  //     break;
  //   case MessageType.SessionReset:
  //     encryption = EncryptionType
  // }

  // export enum EncryptionType {
  //   Signal,
  //   SessionReset,
  //   MediumGroup,
  // }

  // tslint:disable-next-line: no-unnecessary-local-variable
  const rawMessage: RawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    timestamp,
    device: device.key,
    ttl,
    encryption: EncryptionType.Signal,
  };

  return rawMessage;
}

export function generateUniqueChatMessage(): ChatMessage {
  return new ChatMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: uuid(),
    timestamp: Date.now(),
    attachments: undefined,
    quote: undefined,
    expireTimer: undefined,
    lokiProfile: undefined,
    preview: undefined,
  });
}
