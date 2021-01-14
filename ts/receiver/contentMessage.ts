import { EnvelopePlus } from './types';
import { handleDataMessage } from './dataMessage';
import { getEnvelopeId } from './common';

import { removeFromCache, updateCache } from './cache';
import { SignalService } from '../protobuf';
import * as Lodash from 'lodash';
import * as libsession from '../session';
import { handlePairingAuthorisationMessage } from './multidevice';
import { MultiDeviceProtocol, SessionProtocol } from '../session/protocols';
import { PubKey } from '../session/types';

import { handleSyncMessage } from './syncMessages';
import { onError } from './errors';
import ByteBuffer from 'bytebuffer';
import { BlockedNumberController } from '../util/blockedNumberController';
import { GroupUtils, StringUtils } from '../session/utils';
import { UserUtil } from '../util';
import { fromHexToArray, toHex } from '../session/utils/String';
import { concatUInt8Array, getSodium } from '../session/crypto';
import { ConversationController } from '../session/conversations';
import * as Data from '../../js/modules/data';
import { ECKeyPair } from './closedGroupsV2';

export async function handleContentMessage(envelope: EnvelopePlus) {
  try {
    const plaintext = await decrypt(envelope, envelope.content);

    if (!plaintext) {
      // window.log.warn('handleContentMessage: plaintext was falsey');
      return;
    } else if (plaintext instanceof ArrayBuffer && plaintext.byteLength === 0) {
      return;
    }
    await innerHandleContentMessage(envelope, plaintext);
  } catch (e) {
    window.log.warn(e);
  }
}

async function decryptForClosedGroupV2(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer
) {
  // case .closedGroupCiphertext: for ios
  window.log.info('received closed group v2 message');
  try {
    const hexEncodedGroupPublicKey = envelope.source;
    if (!GroupUtils.isMediumGroup(PubKey.cast(hexEncodedGroupPublicKey))) {
      window.log.warn(
        'received medium group message but not for an existing medium group'
      );
      throw new Error('Invalid group public key'); // invalidGroupPublicKey
    }
    const encryptionKeyPairs = await Data.getAllEncryptionKeyPairsForGroupV2(
      hexEncodedGroupPublicKey
    );
    const encryptionKeyPairsCount = encryptionKeyPairs?.length;
    if (!encryptionKeyPairs?.length) {
      throw new Error(
        `No group keypairs for group ${hexEncodedGroupPublicKey}`
      ); // noGroupKeyPair
    }
    // Loop through all known group key pairs in reverse order (i.e. try the latest key pair first (which'll more than
    // likely be the one we want) but try older ones in case that didn't work)
    let decryptedContent: ArrayBuffer | undefined;
    let keyIndex = 0;
    do {
      try {
        const hexEncryptionKeyPair = encryptionKeyPairs.pop();

        if (!hexEncryptionKeyPair) {
          throw new Error('No more encryption keypairs to try for message.');
        }
        const encryptionKeyPair = ECKeyPair.fromHexKeyPair(
          hexEncryptionKeyPair
        );

        decryptedContent = await decryptWithSessionProtocol(
          envelope,
          ciphertext,
          encryptionKeyPair,
          true
        );
        keyIndex++;
      } catch (e) {
        window.log.info(
          `Failed to decrypt closed group v2 with key index ${keyIndex}. We have ${encryptionKeyPairs.length} keys to try left.`
        );
      }
    } while (encryptionKeyPairs.length > 0);

    if (!decryptedContent) {
      await removeFromCache(envelope);
      throw new Error(
        `Could not decrypt message for closed group v2 with any of the ${encryptionKeyPairsCount} keypairs.`
      );
    }
    window.log.info('ClosedGroupV2 Message decrypted successfully.');
    const ourDevicePubKey = await UserUtil.getCurrentDevicePubKey();

    if (
      envelope.senderIdentity &&
      envelope.senderIdentity === ourDevicePubKey
    ) {
      await removeFromCache(envelope);
      window.log.info(
        'Dropping message from our current device after decrypt for closed group v2'
      );
      return null;
    }

    return unpad(decryptedContent);
  } catch (e) {
    window.log.warn(
      'decryptWithSessionProtocol for medium group message throw:',
      e
    );
    await removeFromCache(envelope);
    return null;
  }
}

/**
 * This function can be called to decrypt a keypair wrapper for a closed group update v2
 * or a message sent to a closed group v2.
 *
 * We do not unpad the result here, as in the case of the keypair wrapper, there is not padding.
 * Instead, it is the called who needs to unpad() the content.
 */
export async function decryptWithSessionProtocol(
  envelope: EnvelopePlus,
  ciphertextObj: ArrayBuffer,
  x25519KeyPair: ECKeyPair,
  isClosedGroupV2?: boolean
): Promise<ArrayBuffer> {
  const recipientX25519PrivateKey = x25519KeyPair.privateKeyData;
  const hex = toHex(new Uint8Array(x25519KeyPair.publicKeyData));

  const recipientX25519PublicKey = PubKey.remove05PrefixIfNeeded(hex);

  const sodium = await getSodium();
  const signatureSize = sodium.crypto_sign_BYTES;
  const ed25519PublicKeySize = sodium.crypto_sign_PUBLICKEYBYTES;

  // 1. ) Decrypt the message
  const plaintextWithMetadata = sodium.crypto_box_seal_open(
    new Uint8Array(ciphertextObj),
    fromHexToArray(recipientX25519PublicKey),
    new Uint8Array(recipientX25519PrivateKey)
  );
  if (
    plaintextWithMetadata.byteLength <=
    signatureSize + ed25519PublicKeySize
  ) {
    throw new Error('Decryption failed.'); // throw Error.decryptionFailed;
  }

  // 2. ) Get the message parts
  const signatureStart = plaintextWithMetadata.byteLength - signatureSize;
  const signature = plaintextWithMetadata.subarray(signatureStart);
  const pubkeyStart =
    plaintextWithMetadata.byteLength - (signatureSize + ed25519PublicKeySize);
  const pubkeyEnd = plaintextWithMetadata.byteLength - signatureSize;
  const senderED25519PublicKey = plaintextWithMetadata.subarray(
    pubkeyStart,
    pubkeyEnd
  );
  const plainTextEnd =
    plaintextWithMetadata.byteLength - (signatureSize + ed25519PublicKeySize);
  const plaintext = plaintextWithMetadata.subarray(0, plainTextEnd);

  // 3. ) Verify the signature
  const isValid = sodium.crypto_sign_verify_detached(
    signature,
    concatUInt8Array(
      plaintext,
      senderED25519PublicKey,
      fromHexToArray(recipientX25519PublicKey)
    ),
    senderED25519PublicKey
  );

  if (!isValid) {
    throw new Error('Invalid message signature.'); //throw Error.invalidSignature
  }
  // 4. ) Get the sender's X25519 public key
  const senderX25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(
    senderED25519PublicKey
  );
  if (!senderX25519PublicKey) {
    throw new Error('Decryption failed.'); // Error.decryptionFailed
  }

  // set the sender identity on the envelope itself.
  if (isClosedGroupV2) {
    envelope.senderIdentity = `05${toHex(senderX25519PublicKey)}`;
  } else {
    envelope.source = `05${toHex(senderX25519PublicKey)}`;
  }
  return plaintext;
}

function unpad(paddedData: ArrayBuffer): ArrayBuffer {
  const paddedPlaintext = new Uint8Array(paddedData);

  for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
    if (paddedPlaintext[i] === 0x80) {
      const plaintext = new Uint8Array(i);
      plaintext.set(paddedPlaintext.subarray(0, i));
      return plaintext.buffer;
    } else if (paddedPlaintext[i] !== 0x00) {
      throw new Error('Invalid padding');
    }
  }

  throw new Error('Invalid padding');
}

export async function isBlocked(number: string) {
  return BlockedNumberController.isBlockedAsync(number);
}

async function decryptPreKeyWhisperMessage(
  ciphertext: any,
  sessionCipher: any,
  address: any
): Promise<ArrayBuffer> {
  const padded = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext);

  try {
    return unpad(padded);
  } catch (e) {
    if (e.message === 'Unknown identity key') {
      // create an error that the UI will pick up and ask the
      // user if they want to re-negotiate
      const buffer = ByteBuffer.wrap(ciphertext);
      throw new window.textsecure.IncomingIdentityKeyError(
        address.toString(),
        buffer.toArrayBuffer(),
        e.identityKey
      );
    }
    throw e;
  }
}

async function decryptUnidentifiedSender(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer | null> {
  window.log.info('received unidentified sender message');
  try {
    const userX25519KeyPair = await UserUtil.getIdentityKeyPair();
    if (!userX25519KeyPair) {
      throw new Error('Failed to find User x25519 keypair from stage'); // noUserX25519KeyPair
    }
    const ecKeyPair = ECKeyPair.fromArrayBuffer(
      userX25519KeyPair.pubKey,
      userX25519KeyPair.privKey
    );
    // keep the await so the try catch works as expected
    const retSessionProtocol = await decryptWithSessionProtocol(
      envelope,
      ciphertext,
      ecKeyPair
    );
    return unpad(retSessionProtocol);
  } catch (e) {
    window.log.warn(
      'decryptWithSessionProtocol for unidentified message throw:',
      e
    );
    return null;
  }
}

async function doDecrypt(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer,
  address: any
): Promise<ArrayBuffer | null> {
  const { textsecure, libloki } = window;

  const lokiSessionCipher = new libloki.crypto.LokiSessionCipher(
    textsecure.storage.protocol,
    address
  );
  if (ciphertext.byteLength === 0) {
    throw new Error('Received an empty envelope.'); // Error.noData
  }

  switch (envelope.type) {
    case SignalService.Envelope.Type.CIPHERTEXT:
      window.log.info('message from', getEnvelopeId(envelope));
      return lokiSessionCipher.decryptWhisperMessage(ciphertext).then(unpad);
    case SignalService.Envelope.Type.CLOSED_GROUP_CIPHERTEXT:
      return decryptForClosedGroupV2(envelope, ciphertext);
    case SignalService.Envelope.Type.FALLBACK_MESSAGE: {
      window.log.info('Fallback message from ', envelope.source);

      const fallBackSessionCipher = new libloki.crypto.FallBackSessionCipher(
        address
      );

      return fallBackSessionCipher.decrypt(ciphertext).then(unpad);
    }
    case SignalService.Envelope.Type.PREKEY_BUNDLE:
      window.log.info('prekey message from', getEnvelopeId(envelope));
      return decryptPreKeyWhisperMessage(
        ciphertext,
        lokiSessionCipher,
        address
      );
    case SignalService.Envelope.Type.UNIDENTIFIED_SENDER: {
      return decryptUnidentifiedSender(envelope, ciphertext);
    }
    default:
      throw new Error('Unknown message type');
  }
}

// tslint:disable-next-line: max-func-body-length
async function decrypt(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer
): Promise<any> {
  const { textsecure, libsignal, log } = window;

  // Envelope.source will be null on UNIDENTIFIED_SENDER
  // Don't use it there!
  const address = new libsignal.SignalProtocolAddress(
    envelope.source,
    envelope.sourceDevice
  );

  try {
    const plaintext = await doDecrypt(envelope, ciphertext, address);

    if (!plaintext) {
      await removeFromCache(envelope);
      return null;
    }

    await updateCache(envelope, plaintext).catch((error: any) => {
      window.log.error(
        'decrypt failed to save decrypted message contents to cache:',
        error && error.stack ? error.stack : error
      );
    });

    return plaintext;
  } catch (error) {
    let errorToThrow = error;

    const noSession =
      error &&
      (error.message.indexOf('No record for device') === 0 ||
        error.message.indexOf('decryptWithSessionList: list is empty') === 0);

    if (error && error.message === 'Unknown identity key') {
      // create an error that the UI will pick up and ask the
      // user if they want to re-negotiate
      const buffer = ByteBuffer.wrap(ciphertext);
      errorToThrow = new textsecure.IncomingIdentityKeyError(
        address.toString(),
        buffer.toArrayBuffer(),
        error.identityKey
      );
    } else if (!noSession) {
      // We want to handle "no-session" error, not re-throw it
      throw error;
    }
    const ev: any = new Event('error');
    ev.error = errorToThrow;
    ev.proto = envelope;
    ev.confirm = removeFromCache.bind(null, envelope);

    const returnError = async () => Promise.reject(errorToThrow);

    onError(ev).then(returnError, returnError);
  }
}

function shouldDropBlockedUserMessage(content: SignalService.Content): boolean {
  // Even if the user is blocked, we should allow the message if:
  //   - it is a group message AND
  //   - the group exists already on the db (to not join a closed group created by a blocked user) AND
  //   - the group is not blocked AND
  //   - the message is only control (no body/attachments/quote/groupInvitation/contact/preview)

  if (!content?.dataMessage?.group?.id) {
    return true;
  }
  const groupId = StringUtils.decode(content.dataMessage.group.id, 'utf8');

  const groupConvo = ConversationController.getInstance().get(groupId);
  if (!groupConvo) {
    return true;
  }

  if (groupConvo.isBlocked()) {
    return true;
  }

  // first check that dataMessage is the only field set in the Content
  let msgWithoutDataMessage = Lodash.pickBy(
    content,
    (_, key) => key !== 'dataMessage' && key !== 'toJSON'
  );
  msgWithoutDataMessage = Lodash.pickBy(msgWithoutDataMessage, Lodash.identity);

  const isMessageDataMessageOnly = Lodash.isEmpty(msgWithoutDataMessage);
  if (!isMessageDataMessageOnly) {
    return true;
  }
  const data = content.dataMessage;
  const isControlDataMessageOnly =
    !data.body &&
    !data.contact?.length &&
    !data.preview?.length &&
    !data.attachments?.length &&
    !data.groupInvitation &&
    !data.quote;

  return !isControlDataMessageOnly;
}

export async function innerHandleContentMessage(
  envelope: EnvelopePlus,
  plaintext: ArrayBuffer
): Promise<void> {
  try {
    const content = SignalService.Content.decode(new Uint8Array(plaintext));

    const blocked = await isBlocked(envelope.source);
    if (blocked) {
      // We want to allow a blocked user message if that's a control message for a known group and the group is not blocked
      if (shouldDropBlockedUserMessage(content)) {
        window.log.info('Dropping blocked user message');
        return;
      } else {
        window.log.info(
          'Allowing group-control message only from blocked user'
        );
      }
    }
    const { FALLBACK_MESSAGE } = SignalService.Envelope.Type;

    await ConversationController.getInstance().getOrCreateAndWait(
      envelope.source,
      'private'
    );

    if (envelope.type !== FALLBACK_MESSAGE) {
      const device = new PubKey(envelope.source);

      await SessionProtocol.onSessionEstablished(device);
      await libsession.getMessageQueue().processPending(device);
    }

    if (content.pairingAuthorisation) {
      await handlePairingAuthorisationMessage(
        envelope,
        content.pairingAuthorisation,
        content.dataMessage
      );
      return;
    }

    if (content.syncMessage) {
      await handleSyncMessage(envelope, content.syncMessage);
      return;
    }

    if (content.dataMessage) {
      if (
        content.dataMessage.profileKey &&
        content.dataMessage.profileKey.length === 0
      ) {
        content.dataMessage.profileKey = null;
      }
      await handleDataMessage(envelope, content.dataMessage);
      return;
    }
    if (content.nullMessage) {
      await handleNullMessage(envelope);
      return;
    }
    if (content.callMessage) {
      await handleCallMessage(envelope);
      return;
    }
    if (content.receiptMessage) {
      await handleReceiptMessage(envelope, content.receiptMessage);
      return;
    }
    if (content.typingMessage) {
      if (
        content.typingMessage.groupId &&
        content.typingMessage.groupId.length === 0
      ) {
        content.typingMessage.groupId = null;
      }
      await handleTypingMessage(envelope, content.typingMessage);
      return;
    }
  } catch (e) {
    window.log.warn(e);
  }
}

function onReadReceipt(readAt: any, timestamp: any, reader: any) {
  const { storage, Whisper } = window;

  window.log.info('read receipt', reader, timestamp);

  if (!storage.get('read-receipt-setting')) {
    return;
  }

  const receipt = Whisper.ReadReceipts.add({
    reader,
    timestamp,
    read_at: readAt,
  });

  // Calling this directly so we can wait for completion
  return Whisper.ReadReceipts.onReceipt(receipt);
}

export function onDeliveryReceipt(source: any, timestamp: any) {
  const { Whisper } = window;

  window.log.info('delivery receipt from', `${source}.${1}`, timestamp);

  const receipt = Whisper.DeliveryReceipts.add({
    timestamp,
    source,
  });

  // Calling this directly so we can wait for completion
  return Whisper.DeliveryReceipts.onReceipt(receipt);
}

async function handleReceiptMessage(
  envelope: EnvelopePlus,
  receiptMessage: SignalService.IReceiptMessage
) {
  const receipt = receiptMessage as SignalService.ReceiptMessage;

  const { type, timestamp } = receipt;

  const results = [];
  if (type === SignalService.ReceiptMessage.Type.DELIVERY) {
    for (const ts of timestamp) {
      const promise = onDeliveryReceipt(envelope.source, Lodash.toNumber(ts));
      results.push(promise);
    }
  } else if (type === SignalService.ReceiptMessage.Type.READ) {
    for (const ts of timestamp) {
      const promise = onReadReceipt(
        Lodash.toNumber(envelope.timestamp),
        Lodash.toNumber(ts),
        envelope.source
      );
      results.push(promise);
    }
  }
  await Promise.all(results);

  await removeFromCache(envelope);
}

async function handleNullMessage(envelope: EnvelopePlus) {
  window.log.info('null message from', getEnvelopeId(envelope));
  await removeFromCache(envelope);
}

async function handleCallMessage(envelope: EnvelopePlus) {
  window.log.info('call message from', getEnvelopeId(envelope));
  await removeFromCache(envelope);
}

async function handleTypingMessage(
  envelope: EnvelopePlus,
  iTypingMessage: SignalService.ITypingMessage
): Promise<void> {
  const ev = new Event('typing');

  const typingMessage = iTypingMessage as SignalService.TypingMessage;

  const { timestamp, groupId, action } = typingMessage;
  const { source } = envelope;

  await removeFromCache(envelope);

  if (envelope.timestamp && timestamp) {
    const envelopeTimestamp = Lodash.toNumber(envelope.timestamp);
    const typingTimestamp = Lodash.toNumber(timestamp);

    if (typingTimestamp !== envelopeTimestamp) {
      window.log.warn(
        `Typing message envelope timestamp (${envelopeTimestamp}) did not match typing timestamp (${typingTimestamp})`
      );
      return;
    }
  }

  // We don't do anything with incoming typing messages if the setting is disabled
  if (!window.storage.get('typing-indicators-setting')) {
    return;
  }

  // A sender here could be referring to a group.
  // Groups don't have primary devices so we need to take that into consideration.
  // Note: we do not support group typing message for now.
  const user = PubKey.from(source);
  const primaryDevice = user
    ? await MultiDeviceProtocol.getPrimaryDevice(user)
    : null;

  const convoId = (primaryDevice && primaryDevice.key) || source;

  const conversation = ConversationController.getInstance().get(convoId);

  const started = action === SignalService.TypingMessage.Action.STARTED;

  if (conversation) {
    const senderDevice = 1;
    conversation.notifyTyping({
      isTyping: started,
      sender: source,
      senderDevice,
    });
  }
}
