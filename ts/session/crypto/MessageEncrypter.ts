import { EncryptionType } from '../types/EncryptionType';
import { SignalService } from '../../protobuf';
import { UserUtil } from '../../util';
import { CipherTextObject } from '../../../libtextsecure/libsignal-protocol';
import { PubKey } from '../types';

/**
 * Add padding to a message buffer
 * @param messageBuffer The buffer to add padding to.
 */
export function padPlainTextBuffer(messageBuffer: Uint8Array): Uint8Array {
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

/**
 * Encrypt `plainTextBuffer` with given `encryptionType` for `device`.
 *
 * @param device The device `PubKey` to encrypt for.
 * @param plainTextBuffer The unpadded plaintext buffer.
 * @param encryptionType The type of encryption.
 * @returns The envelope type and the base64 encoded cipher text
 */
export async function encrypt(
  device: PubKey,
  plainTextBuffer: Uint8Array,
  encryptionType: EncryptionType
): Promise<{
  envelopeType: SignalService.Envelope.Type;
  cipherText: Uint8Array;
}> {
  const plainText = padPlainTextBuffer(plainTextBuffer);
  const address = new window.libsignal.SignalProtocolAddress(device.key, 1);

  if (encryptionType === EncryptionType.MediumGroup) {
    // TODO: Do medium group stuff here
    throw new Error('Encryption is not yet supported');
  }

  let innerCipherText: CipherTextObject;
  if (encryptionType === EncryptionType.Fallback) {
    const cipher = new window.libloki.crypto.FallBackSessionCipher(address);
    innerCipherText = await cipher.encrypt(plainText.buffer);
  } else {
    const cipher = new window.libsignal.SessionCipher(
      window.textsecure.storage.protocol,
      address
    );
    innerCipherText = await cipher.encrypt(plainText.buffer);
  }

  return encryptUsingSealedSender(device, innerCipherText);
}

async function encryptUsingSealedSender(
  device: PubKey,
  innerCipherText: CipherTextObject
): Promise<{
  envelopeType: SignalService.Envelope.Type;
  cipherText: Uint8Array;
}> {
  const ourNumber = await UserUtil.getCurrentDevicePubKey();
  if (!ourNumber) {
    throw new Error('Failed to fetch current device public key.');
  }

  const certificate = SignalService.SenderCertificate.create({
    sender: ourNumber,
    senderDevice: 1,
  });

  const cipher = new window.Signal.Metadata.SecretSessionCipher(
    window.textsecure.storage.protocol
  );
  const cipherTextBuffer = await cipher.encrypt(
    device.key,
    certificate,
    innerCipherText
  );

  return {
    envelopeType: SignalService.Envelope.Type.UNIDENTIFIED_SENDER,
    cipherText: new Uint8Array(cipherTextBuffer),
  };
}
