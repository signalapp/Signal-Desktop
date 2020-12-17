import { RawMessage } from '../types/RawMessage';
import { ContentMessage, MediumGroupChatMessage } from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { MediumGroupUpdateMessage } from '../messages/outgoing/content/data/mediumgroup/MediumGroupUpdateMessage';

export async function toRawMessage(
  device: PubKey,
  message: ContentMessage
): Promise<RawMessage> {
  const timestamp = message.timestamp;
  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();

  let encryption: EncryptionType;
  if (
    message instanceof MediumGroupChatMessage ||
    message instanceof MediumGroupUpdateMessage
  ) {
    encryption = EncryptionType.MediumGroup;
  } else {
    encryption = EncryptionType.Fallback;
  }
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
