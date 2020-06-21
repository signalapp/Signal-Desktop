import { RawMessage } from '../types/';
import { ContentMessage } from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';

export function toRawMessage(
  device: PubKey,
  message: ContentMessage
): RawMessage {
  const timestamp = message.timestamp;
  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();

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
