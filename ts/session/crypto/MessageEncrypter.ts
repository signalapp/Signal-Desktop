import { EncryptionType } from '../types/EncryptionType';
import { SignalService } from '../../protobuf';
import { libloki, libsignal, textsecure } from '../../window';
import {
  CipherTextObject,
  SignalProtocolAddress,
} from '../../../libtextsecure/libsignal-protocol';

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

export type Base64String = String;

/**
 * Encrypt `plainTextBuffer` with given `encryptionType` for `device`.
 *
 * @param device The device to encrypt for.
 * @param plainTextBuffer The unpadded plaintext buffer.
 * @param encryptionType The type of encryption.
 * @returns The envelope type and the base64 encoded cipher text
 */
export async function encrypt(
  device: string,
  plainTextBuffer: Uint8Array,
  encryptionType: EncryptionType
): Promise<{
  envelopeType: SignalService.Envelope.Type;
  cipherText: Base64String;
}> {
  const plainText = padPlainTextBuffer(plainTextBuffer);
  const address = new libsignal.SignalProtocolAddress(device, 1);

  if (encryptionType === EncryptionType.MediumGroup) {
    // TODO: Do medium group stuff here
    throw new Error('Encryption is not yet supported');
  }

  let cipherText: CipherTextObject;
  if (encryptionType === EncryptionType.SessionReset) {
    const cipher = new libloki.crypto.FallBackSessionCipher(address);
    cipherText = await cipher.encrypt(plainText.buffer);
  } else {
    const cipher = new libsignal.SessionCipher(
      textsecure.storage.protocol,
      address
    );
    cipherText = await cipher.encrypt(plainText.buffer);
  }

  return encryptUsingSealedSender(address, cipherText);
}

async function encryptUsingSealedSender(
  address: SignalProtocolAddress,
  cipherText: CipherTextObject
): Promise<{
  envelopeType: SignalService.Envelope.Type;
  cipherText: Base64String;
}> {
  // TODO: Do stuff here
  return {
    envelopeType: SignalService.Envelope.Type.UNIDENTIFIED_SENDER,
    cipherText: 'implement me!',
  };
}
