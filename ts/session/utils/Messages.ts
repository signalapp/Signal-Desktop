import { RawMessage } from '../types/RawMessage';
import {
  ContentMessage,
  ExpirationTimerUpdateMessage,
} from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { ClosedGroupMessage } from '../messages/outgoing/content/data/group/ClosedGroupMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/content/data/group/ClosedGroupNewMessage';

import _ from 'lodash';
import { ClosedGroupEncryptionPairReplyMessage } from '../messages/outgoing/content/data/group/ClosedGroupEncryptionPairReplyMessage';

function getEncryptionTypeFromMessageType(
  message: ContentMessage
): EncryptionType {
  // ClosedGroupNewMessage is sent using established channels, so using fallback
  if (
    message instanceof ClosedGroupNewMessage ||
    message instanceof ClosedGroupEncryptionPairReplyMessage
  ) {
    return EncryptionType.Fallback;
  }

  // 1. any ClosedGroupMessage which is not a ClosedGroupNewMessage must be encoded with ClosedGroup
  // 2. if TypingMessage or ExpirationTimer and groupId is set => must be encoded with ClosedGroup too
  if (
    message instanceof ClosedGroupMessage ||
    (message instanceof ExpirationTimerUpdateMessage && message.groupId)
  ) {
    return EncryptionType.ClosedGroup;
  } else {
    return EncryptionType.Fallback;
  }
}

export async function toRawMessage(
  device: PubKey,
  message: ContentMessage
): Promise<RawMessage> {
  const timestamp = message.timestamp;
  const ttl = message.ttl();
  // window?.log?.debug('toRawMessage proto:', message.contentProto());
  const plainTextBuffer = message.plainTextBuffer();

  const encryption = getEncryptionTypeFromMessageType(message);

  // tslint:disable-next-line: no-unnecessary-local-variable
  const rawMessage: RawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    timestamp,
    device: device.key,
    ttl,
    encryption,
  };

  return rawMessage;
}
