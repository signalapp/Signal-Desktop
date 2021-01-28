import { EncryptionType } from '../types/EncryptionType';
import { SignalService } from '../../protobuf';
import { PubKey } from '../types';
import { concatUInt8Array, getSodium } from '.';
import { fromHexToArray } from '../utils/String';
export { concatUInt8Array, getSodium };
import { getLatestClosedGroupEncryptionKeyPair } from '../../../js/modules/data';
import { UserUtils } from '../utils';

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
 * @param plainTextBuffer The unpadded plaintext buffer. It will be padded
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
  if (
    encryptionType !== EncryptionType.ClosedGroup &&
    encryptionType !== EncryptionType.Fallback
  ) {
    throw new Error(`Invalid encryption type:${encryptionType}`);
  }
  const encryptForClosedGroup = encryptionType === EncryptionType.ClosedGroup;
  const plainText = padPlainTextBuffer(plainTextBuffer);

  if (encryptForClosedGroup) {
    window?.log?.info(
      'Encrypting message with SessionProtocol and envelope type is CLOSED_GROUP_CIPHERTEXT'
    );
    const hexEncryptionKeyPair = await getLatestClosedGroupEncryptionKeyPair(
      device.key
    );
    if (!hexEncryptionKeyPair) {
      window?.log?.warn(
        "Couldn't get key pair for closed group during encryption"
      );
      throw new Error("Couldn't get key pair for closed group");
    }
    const hexPubFromECKeyPair = PubKey.cast(hexEncryptionKeyPair.publicHex);

    // the exports is to reference the exported function, so when we stub it during test, we stub the one called here

    const cipherTextClosedGroup = await exports.encryptUsingSessionProtocol(
      hexPubFromECKeyPair,
      plainText
    );

    return {
      envelopeType: CLOSED_GROUP_CIPHERTEXT,
      cipherText: cipherTextClosedGroup,
    };
  }

  const cipherText = await exports.encryptUsingSessionProtocol(
    device,
    plainText
  );
  return { envelopeType: UNIDENTIFIED_SENDER, cipherText };
}

export async function encryptUsingSessionProtocol(
  recipientHexEncodedX25519PublicKey: PubKey,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const userED25519KeyPairHex = await UserUtils.getUserED25519KeyPair();
  if (
    !userED25519KeyPairHex ||
    !userED25519KeyPairHex.pubKey?.length ||
    !userED25519KeyPairHex.privKey?.length
  ) {
    throw new Error("Couldn't find user ED25519 key pair.");
  }
  const sodium = await getSodium();

  window?.log?.info(
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
