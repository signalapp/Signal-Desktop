import { RawMessage } from '../types/RawMessage';
import {
  ContentMessage,
  MediumGroupMessage,
  SessionRequestMessage,
} from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { SessionProtocol } from '../protocols';

export async function toRawMessage(
  device: PubKey,
  message: ContentMessage
): Promise<RawMessage> {
  const timestamp = message.timestamp;
  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();

  let encryption: EncryptionType;
  if (message instanceof MediumGroupMessage) {
    encryption = EncryptionType.MediumGroup;
  } else if (message instanceof SessionRequestMessage) {
    encryption = EncryptionType.Fallback;
  } else {
    // If we don't have a session yet then send using fallback encryption until we have a session
    const hasSession = await SessionProtocol.hasSession(device);
    encryption = hasSession ? EncryptionType.Signal : EncryptionType.Fallback;
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
