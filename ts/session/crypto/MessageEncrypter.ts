import { EncryptionType } from '../types/EncryptionType';
import { SignalService } from '../../protobuf';

function padPlainTextBuffer(messageBuffer: Uint8Array): Uint8Array {
  const plaintext = new Uint8Array(
    getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
  );
  plaintext.set(new Uint8Array(messageBuffer));
  plaintext[messageBuffer.byteLength] = 0x80;

  return plaintext;
}

function getPaddedMessageLength(originalLength: number): number {
  const messageLengthWithTerminator = originalLength + 1;
  let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

  if (messageLengthWithTerminator % 160 !== 0) {
    messagePartCount += 1;
  }

  return messagePartCount * 160;
}

export function encrypt(
  device: string,
  plainTextBuffer: Uint8Array,
  encryptionType: EncryptionType
): {
  envelopeType: SignalService.Envelope.Type;
  cipherText: Uint8Array;
} {
  const plainText = padPlainTextBuffer(plainTextBuffer);
  // TODO: Do encryption here?
  return {
    envelopeType: SignalService.Envelope.Type.CIPHERTEXT,
    cipherText: new Uint8Array(),
  };
}
