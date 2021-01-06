import { EncryptionType } from '../types/EncryptionType';
import { SignalService } from '../../protobuf';
import { UserUtil } from '../../util';
import { CipherTextObject } from '../../../libtextsecure/libsignal-protocol';
import { encryptWithSenderKey } from '../../session/medium_group/ratchet';
import { PubKey } from '../types';
import { StringUtils } from '../utils';
import { concatUInt8Array, getSodium } from '.';
export { concatUInt8Array, getSodium };

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

type EncryptResult = {
  envelopeType: SignalService.Envelope.Type;
  cipherText: Uint8Array;
};

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
): Promise<EncryptResult> {
  const plainText = padPlainTextBuffer(plainTextBuffer);

  if (encryptionType === EncryptionType.MediumGroup) {
    return encryptForMediumGroup(device, plainText);
  }

  const address = new window.libsignal.SignalProtocolAddress(device.key, 1);

  if (encryptionType === EncryptionType.Signal) {
    console.warn(
      'EncryptionType.Signal is deprecated. Only Fallback is supported'
    );
  }

  const cipher = new window.libloki.crypto.FallBackSessionCipher(address);
  const innerCipherText = await cipher.encrypt(plainText.buffer);

  return encryptUsingSealedSender(device, innerCipherText);
}

export async function encryptUsingSessionProtocol(
  recipientHexEncodedX25519PublicKey: PubKey,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const userED25519KeyPairHex = await UserUtil.getUserED25519KeyPair();
  if (!userED25519KeyPairHex) {
    throw new Error("Couldn't find user ED25519 key pair.");
  }
  const sodium = await getSodium();

  const recipientX25519PublicKeyWithoutPrefix = PubKey.remove05PrefixIfNeeded(
    recipientHexEncodedX25519PublicKey.key
  );

  const recipientX25519PublicKey = new Uint8Array(
    StringUtils.fromHex(recipientX25519PublicKeyWithoutPrefix)
  );
  const userED25519PubKeyBytes = new Uint8Array(
    StringUtils.fromHex(userED25519KeyPairHex.pubKey)
  );
  const userED25519SecretKeyBytes = new Uint8Array(
    StringUtils.fromHex(userED25519KeyPairHex.privKey)
  );

  // merge all arrays into one
  const dataForSign = concatUInt8Array(
    plaintext,
    userED25519PubKeyBytes,
    recipientX25519PublicKey
  );

  const signature = sodium.crypto_sign_detached(
    dataForSign,
    userED25519SecretKeyBytes
  );
  if (!signature) {
    throw new Error("Couldn't sign message");
  }

  const dataForBoxSeal = concatUInt8Array(
    plaintext,
    userED25519PubKeyBytes,
    signature
  );

  const ciphertext = sodium.crypto_box_seal(
    dataForBoxSeal,
    recipientX25519PublicKey
  );
  if (!ciphertext) {
    throw new Error("Couldn't encrypt message.");
  }
  return ciphertext;
}

export async function encryptForMediumGroup(
  device: PubKey,
  plainTextBuffer: Uint8Array
): Promise<EncryptResult> {
  const ourKey = (await UserUtil.getCurrentDevicePubKey()) as string;

  // "Device" does not really make sense for medium groups, but
  // that's where the group pubkey is currently stored
  const groupId = device.key;

  const { ciphertext, keyIdx } = await encryptWithSenderKey(
    plainTextBuffer,
    groupId,
    ourKey
  );

  // We should include ciphertext idx in the message
  const content = SignalService.MediumGroupCiphertext.encode({
    ciphertext,
    source: new Uint8Array(StringUtils.encode(ourKey, 'hex')),
    keyIdx,
  }).finish();

  // Encrypt for the group's identity key to hide source and key idx:
  const {
    ciphertext: ciphertextOuter,
    ephemeralKey,
  } = await window.libloki.crypto.encryptForPubkey(groupId, content);

  const contentOuter = SignalService.MediumGroupContent.encode({
    ciphertext: ciphertextOuter,
    ephemeralKey: new Uint8Array(ephemeralKey),
  }).finish();

  const envelopeType = SignalService.Envelope.Type.MEDIUM_GROUP_CIPHERTEXT;

  return { envelopeType, cipherText: contentOuter };
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
