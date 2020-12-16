import { EnvelopePlus } from './types';
import { handleDataMessage } from './dataMessage';
import { getEnvelopeId } from './common';

import { removeFromCache, updateCache } from './cache';
import { SignalService } from '../protobuf';
import * as Lodash from 'lodash';
import * as libsession from '../session';
import { handleSessionRequestMessage } from './sessionHandling';
import { handlePairingAuthorisationMessage } from './multidevice';
import { MediumGroupRequestKeysMessage } from '../session/messages/outgoing';
import { MultiDeviceProtocol, SessionProtocol } from '../session/protocols';
import { PubKey } from '../session/types';

import { handleSyncMessage } from './syncMessages';
import { onError } from './errors';
import ByteBuffer from 'bytebuffer';
import { BlockedNumberController } from '../util/blockedNumberController';
import { decryptWithSenderKey } from '../session/medium_group/ratchet';
import { StringUtils } from '../session/utils';
import { UserUtil } from '../util';
import { fromHex, toHex } from '../session/utils/String';
import { concatUInt8Array, getSodium } from '../session/crypto';

export async function handleContentMessage(envelope: EnvelopePlus) {
  try {
    const plaintext = await decrypt(envelope, envelope.content);

    if (!plaintext) {
      window.log.warn('handleContentMessage: plaintext was falsey');
      return;
    } else if (plaintext instanceof ArrayBuffer && plaintext.byteLength === 0) {
      return;
    }
    await innerHandleContentMessage(envelope, plaintext);
  } catch (e) {
    window.log.warn(e);
  }
}

async function decryptWithSharedSenderKeys(
  envelope: EnvelopePlus,
  ciphertextObj: ArrayBuffer
): Promise<ArrayBuffer | null> {
  const { dcodeIO, libloki } = window;

  const groupId = envelope.source;

  const identity = await window.Signal.Data.getIdentityKeyById(groupId);
  const secretKeyHex = identity.secretKey;

  if (!secretKeyHex) {
    throw new Error(`Secret key is empty for group ${groupId}!`);
  }

  const {
    ciphertext: outerCiphertext,
    ephemeralKey,
  } = SignalService.MediumGroupContent.decode(new Uint8Array(ciphertextObj));

  const secretKey = dcodeIO.ByteBuffer.wrap(
    secretKeyHex,
    'hex'
  ).toArrayBuffer();

  const mediumGroupCiphertext = await libloki.crypto.decryptForPubkey(
    secretKey,
    ephemeralKey,
    outerCiphertext
  );

  const {
    source,
    ciphertext,
    keyIdx,
  } = SignalService.MediumGroupCiphertext.decode(
    new Uint8Array(mediumGroupCiphertext)
  );
  const ourNumber = (await UserUtil.getCurrentDevicePubKey()) as string;
  const sourceAsStr = StringUtils.decode(source, 'hex');
  if (sourceAsStr === ourNumber) {
    window.log.info(
      'Dropping message from ourself after decryptForMediumGroup'
    );
    return null;
  }
  envelope.senderIdentity = sourceAsStr;
  const plaintext = await decryptWithSenderKey(
    ciphertext,
    keyIdx,
    groupId,
    sourceAsStr
  );
  return plaintext ? unpad(plaintext) : null;
}

async function decryptForMediumGroup(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer
) {
  window.log.info('received medium group message');
  try {
    // keep the await so the try catch works as expcted
    const retSessionProtocol = await decryptWithSessionProtocol(
      envelope,
      ciphertext
    );
    return retSessionProtocol;
  } catch {
    const retSSK = await decryptWithSharedSenderKeys(envelope, ciphertext);
    return retSSK;
  }
}

async function decryptWithSessionProtocol(
  envelope: EnvelopePlus,
  ciphertextObj: ArrayBuffer
): Promise<ArrayBuffer> {
  if (ciphertextObj.byteLength === 0) {
    throw new Error('Received an empty envelope.'); // Error.noData
  }

  let recipientX25519PrivateKey: ArrayBuffer;
  let recipientX25519PublicKey: Uint8Array;
  let isMediumGroup = false;
  switch (envelope.type) {
    case SignalService.Envelope.Type.UNIDENTIFIED_SENDER: {
      const userX25519KeyPair = await UserUtil.getIdentityKeyPair();
      if (!userX25519KeyPair) {
        throw new Error("Couldn't find user X25519 key pair."); // Error.noUserX25519KeyPair
      }
      recipientX25519PrivateKey = userX25519KeyPair.privKey;
      const recipientX25519PublicKeyHex = toHex(userX25519KeyPair.pubKey);
      const recipientX25519PublicKeyWithoutPrefix = PubKey.remove05PrefixIfNeeded(
        recipientX25519PublicKeyHex
      );
      recipientX25519PublicKey = new Uint8Array(
        fromHex(recipientX25519PublicKeyWithoutPrefix)
      );
      break;
    }

    // this is .closedGroupCiphertext for mobile
    case SignalService.Envelope.Type.MEDIUM_GROUP_CIPHERTEXT: {
      const hexEncodedGroupPublicKey = envelope.source;

      isMediumGroup = window.ConversationController.isMediumGroup(
        hexEncodedGroupPublicKey
      );

      if (!isMediumGroup) {
        throw new Error('Invalid group public key.'); // Error.invalidGroupPublicKey
      }

      recipientX25519PrivateKey = await libsession.MediumGroup.getGroupSecretKey(
        hexEncodedGroupPublicKey
      ); // throws if not found
      recipientX25519PublicKey = new Uint8Array(
        fromHex(hexEncodedGroupPublicKey)
      );

      break;
    }
    default:
      throw new Error('decryptWithSessionProtocol: Unknown message type');
  }

  const sodium = await getSodium();
  const signatureSize = sodium.crypto_sign_BYTES;
  const ed25519PublicKeySize = sodium.crypto_sign_PUBLICKEYBYTES;

  // 1. ) Decrypt the message
  const plaintextWithMetadata = sodium.crypto_box_seal_open(
    new Uint8Array(ciphertextObj),
    recipientX25519PublicKey,
    new Uint8Array(recipientX25519PrivateKey)
  );
  if (plaintextWithMetadata.byteLength > signatureSize + ed25519PublicKeySize) {
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
  // FIXME, why don't we have a sodium.crypto_sign_verify ?
  const isValid = sodium.crypto_sign_verify_detached(
    signature,
    concatUInt8Array(
      plaintext,
      senderED25519PublicKey,
      recipientX25519PublicKey
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
  if (isMediumGroup) {
    envelope.senderIdentity = `05${toHex(senderX25519PublicKey)}`;
  }
  return unpad(plaintext);
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

async function decryptWithSignalProtocol(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer | null> {
  const { textsecure } = window;

  const secretSessionCipher = new window.Signal.Metadata.SecretSessionCipher(
    textsecure.storage.protocol
  );

  const ourNumber = textsecure.storage.user.getNumber();
  const me = { number: ourNumber, deviceId: 1 };

  let result;

  const { source: originalSource } = envelope;

  try {
    result = await secretSessionCipher.decrypt(ciphertext, me);
  } catch (error) {
    window.log.error('Error decrypting unidentified sender: ', error);

    const { sender: source } = error || {};

    if (source) {
      const blocked = await isBlocked(source.getName());
      if (blocked) {
        window.log.info(
          'Dropping blocked message with error after sealed sender decryption'
        );
        await removeFromCache(envelope);
        return null;
      }

      if (error.message.startsWith('No sessions for device ')) {
        // Receives a message from a specific device but we did not have a session with him.
        // We trigger a session request.
        await SessionProtocol.sendSessionRequestIfNeeded(
          PubKey.cast(source.getName())
        );
      }

      // eslint-disable no-param-reassign
      envelope.source = source.getName();
      envelope.sourceDevice = source.getDeviceId();
      envelope.unidentifiedDeliveryReceived = !originalSource;
      // eslint-enable no-param-reassign
      await removeFromCache(envelope);
      throw error;
    }

    await removeFromCache(envelope);
    throw error;
  }

  const { isMe, sender, content, type } = result;

  // We need to drop incoming messages from ourself since server can't
  //   do it for us
  if (isMe) {
    return null;
  }

  // We might have substituted the type based on decrypted content
  if (type === SignalService.Envelope.Type.FALLBACK_MESSAGE) {
    // eslint-disable-next-line no-param-reassign
    envelope.type = SignalService.Envelope.Type.FALLBACK_MESSAGE;
  }

  // Here we take this sender information and attach it back to the envelope
  //   to make the rest of the app work properly.

  // eslint-disable-next-line no-param-reassign
  envelope.source = sender.getName();
  // eslint-disable-next-line no-param-reassign
  envelope.sourceDevice = sender.getDeviceId();
  // eslint-disable-next-line no-param-reassign
  envelope.unidentifiedDeliveryReceived = !originalSource;

  // Return just the content because that matches the signature of the other
  // decrypt methods used above.
  return unpad(content);
}

async function decryptUnidentifiedSender(
  envelope: EnvelopePlus,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer | null> {
  window.log.info('received unidentified sender message');
  try {
    // keep the await so the try catch works as expected
    const retSessionProtocol = await decryptWithSessionProtocol(
      envelope,
      ciphertext
    );
    return retSessionProtocol;
  } catch {
    const retSignalProtocol = await decryptWithSignalProtocol(
      envelope,
      ciphertext
    );
    return retSignalProtocol;
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

  switch (envelope.type) {
    case SignalService.Envelope.Type.CIPHERTEXT:
      window.log.info('message from', getEnvelopeId(envelope));
      return lokiSessionCipher.decryptWhisperMessage(ciphertext).then(unpad);
    case SignalService.Envelope.Type.MEDIUM_GROUP_CIPHERTEXT:
      return decryptForMediumGroup(envelope, ciphertext);
    case SignalService.Envelope.Type.FALLBACK_MESSAGE: {
      window.log.info('fallback message from ', envelope.source);

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
    if (error && error instanceof textsecure.SenderKeyMissing) {
      const groupId = envelope.source;
      const { senderIdentity } = error;
      if (senderIdentity) {
        log.info(
          'Requesting missing key for identity: ',
          senderIdentity,
          'groupId: ',
          groupId
        );

        const params = {
          timestamp: Date.now(),
          groupId,
        };

        const requestKeysMessage = new MediumGroupRequestKeysMessage(params);
        const sender = new PubKey(senderIdentity);
        void libsession.getMessageQueue().send(sender, requestKeysMessage);

        return;
      }
    } else if (error instanceof window.textsecure.PreKeyMissing) {
      // this error can mean two things
      // 1. The sender received a session request message from us, used it to establish a session, but restored from seed
      //    Depending on the the date of our messsage, on restore from seed the sender might get our session request again
      //    He will try to use it to establish a session. In this case, we should reset the session as we cannot decode its message.
      // 2. We sent a session request to the sender and he established it. But if he sends us a message before we send one to him, he will
      //    include the prekeyId in that new message.
      //    We won't find this preKeyId as we already burnt it when the sender established the session.

      const convo = window.ConversationController.get(envelope.source);
      if (!convo) {
        window.log.warn('PreKeyMissing but convo is missing too. Dropping...');
        return;
      }
      void convo.endSession();

      return;
    }

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

  const groupConvo = window.ConversationController.get(groupId);
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
  const { ConversationController } = window;
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

    await ConversationController.getOrCreateAndWait(envelope.source, 'private');

    if (content.preKeyBundleMessage) {
      await handleSessionRequestMessage(envelope, content.preKeyBundleMessage);
    } else if (envelope.type !== FALLBACK_MESSAGE) {
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

  const { ConversationController } = window;
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

  const conversation = ConversationController.get(convoId);

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
