import { RawMessage } from '../types/RawMessage';
import { ContentMessage, SessionRequestMessage } from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';

export function toRawMessage(
  device: PubKey,
  message: ContentMessage
): RawMessage {
  const ttl = message.ttl();
  const timestamp = message.timestamp;
  const plainTextBuffer = message.plainTextBuffer();
  const encryption =
    message instanceof SessionRequestMessage
      ? EncryptionType.SessionRequest
      : EncryptionType.Signal;

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
