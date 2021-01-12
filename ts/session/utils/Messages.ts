import { RawMessage } from '../types/RawMessage';
import { ContentMessage } from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { ClosedGroupV2Message } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2Message';
import { ClosedGroupV2NewMessage } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2NewMessage';
import { ClosedGroupV2ChatMessage } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2ChatMessage';

export async function toRawMessage(
  device: PubKey,
  message: ContentMessage
): Promise<RawMessage> {
  const timestamp = message.timestamp;
  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();

  let encryption: EncryptionType;

  // ClosedGroupV2NewMessage is sent using established channels, so using fallback
  if (
    (message instanceof ClosedGroupV2ChatMessage ||
      message instanceof ClosedGroupV2Message) &&
    !(message instanceof ClosedGroupV2NewMessage)
  ) {
    encryption = EncryptionType.ClosedGroup;
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
