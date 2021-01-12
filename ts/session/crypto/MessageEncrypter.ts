import { EncryptionType } from '../types/EncryptionType';
import { SignalService } from '../../protobuf';
import { UserUtil } from '../../util';
import { CipherTextObject } from '../../../libtextsecure/libsignal-protocol';
import { PubKey } from '../types';
import { concatUInt8Array, getSodium } from '.';
import { fromHexToArray } from '../utils/String';
import { ECKeyPair } from '../../receiver/closedGroupsV2';
export { concatUInt8Array, getSodium };
import * as Data from '../../../js/modules/data';

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
  const {
    CLOSED_GROUP_CIPHERTEXT,
    UNIDENTIFIED_SENDER,
  } = SignalService.Envelope.Type;
  const encryptForClosedGroupV2 = encryptionType === EncryptionType.ClosedGroup;
  const plainText = padPlainTextBuffer(plainTextBuffer);

  if (encryptForClosedGroupV2) {
    window.log.info(
      'Encrypting message with SessionProtocol and envelope type is CLOSED_GROUP_CIPHERTEXT'
    );
    const hexEncryptionKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(
      device.key
    );
    if (!hexEncryptionKeyPair) {
      window.log.warn(
        "Couldn't get key pair for closed group during encryption"
      );
      throw new Error("Couldn't get key pair for closed group");
    }
    const hexPubFromECKeyPair = PubKey.cast(hexEncryptionKeyPair.publicHex);

    const cipherTextClosedGroupV2 = await encryptUsingSessionProtocol(
      hexPubFromECKeyPair,
      plainText
    );

    return {
      envelopeType: CLOSED_GROUP_CIPHERTEXT,
      cipherText: cipherTextClosedGroupV2,
    };
  }

  const cipherText = await encryptUsingSessionProtocol(device, plainText);
  return { envelopeType: UNIDENTIFIED_SENDER, cipherText };
}

export async function encryptUsingSessionProtocol(
  recipientHexEncodedX25519PublicKey: PubKey,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const userED25519KeyPairHex = await UserUtil.getUserED25519KeyPair();
  if (
    !userED25519KeyPairHex ||
    !userED25519KeyPairHex.pubKey?.length ||
    !userED25519KeyPairHex.privKey?.length
  ) {
    throw new Error("Couldn't find user ED25519 key pair.");
  }
  const sodium = await getSodium();

  window.log.info(
    'encryptUsingSessionProtocol for ',
    recipientHexEncodedX25519PublicKey
  );

  const recipientX25519PublicKey = recipientHexEncodedX25519PublicKey.withoutPrefixToArray();
  const userED25519PubKeyBytes = fromHexToArray(userED25519KeyPairHex.pubKey);
  const userED25519SecretKeyBytes = fromHexToArray(
    userED25519KeyPairHex.privKey
  );

  // merge all arrays into one
  const verificationData = concatUInt8Array(
    plaintext,
    userED25519PubKeyBytes,
    recipientX25519PublicKey
  );

  const signature = sodium.crypto_sign_detached(
    verificationData,
    userED25519SecretKeyBytes
  );
  if (!signature || signature.length === 0) {
    throw new Error("Couldn't sign message");
  }

  const plaintextWithMetadata = concatUInt8Array(
    plaintext,
    userED25519PubKeyBytes,
    signature
  );

  const ciphertext = sodium.crypto_box_seal(
    plaintextWithMetadata,
    recipientX25519PublicKey
  );
  if (!ciphertext) {
    throw new Error("Couldn't encrypt message.");
  }
  return ciphertext;
}

async function encryptUsingSealedSender(
  device: PubKey,
  innerCipherText: CipherTextObject
): Promise<{
  cipherText: Uint8Array;
  envelopeType: SignalService.Envelope.Type;
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
  window.log.info(
    'Encrypting message with SealedSender and envelope type is UNIDENTIFIED_SENDER'
  );

  return {
    envelopeType: SignalService.Envelope.Type.UNIDENTIFIED_SENDER,
    cipherText: new Uint8Array(cipherTextBuffer),
  };
}
