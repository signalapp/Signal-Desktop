import { RawMessage } from '../types/RawMessage';
import { ContentMessage, SyncMessage, OpenGroupMessage } from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { OpenGroup } from '../types/OpenGroup';

export function toRawMessage(
  device: PubKey | OpenGroup,
  message: ContentMessage | OpenGroupMessage
): RawMessage {
  const timestamp = message.timestamp;

  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();

  const sendTo = device instanceof PubKey
    ? device.key
    : device.conversationId;

  // tslint:disable-next-line: no-unnecessary-local-variable
  const rawMessage: RawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    timestamp,
    device: sendTo,
    ttl,
    encryption: EncryptionType.Signal,
  };

  return rawMessage;
}
