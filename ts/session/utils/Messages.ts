import { RawMessage } from '../types/RawMessage';
import {
  ContentMessage,
  ExpirationTimerUpdateMessage,
  TypingMessage,
} from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { ClosedGroupV2Message } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2Message';
import { ClosedGroupV2NewMessage } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2NewMessage';

export function getEncryptionTypeFromMessageType(
  message: ContentMessage
): EncryptionType {
  // ClosedGroupV2NewMessage is sent using established channels, so using fallback
  if (message instanceof ClosedGroupV2NewMessage) {
    return EncryptionType.Fallback;
  }

  // 1. any ClosedGroupV2Message which is not a ClosedGroupV2NewMessage must be encoded with ClosedGroup
  // 2. if TypingMessage or ExpirationTimer and groupId is set => must be encoded with ClosedGroup too
  if (
    message instanceof ClosedGroupV2Message ||
    (message instanceof ExpirationTimerUpdateMessage && message.groupId)) {
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
  window?.log?.debug('toRawMessage proto:', message.contentProto());
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
