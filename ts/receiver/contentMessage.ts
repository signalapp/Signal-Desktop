import { EnvelopePlus } from './types';
import { handleDataMessage } from './dataMessage';
import { getEnvelopeId } from './common';

import { removeFromCache, updateCache } from './cache';
import { SignalService } from '../protobuf';
import { toNumber } from 'lodash';
import * as libsession from '../session';
import { handleSessionRequestMessage } from './sessionHandling';
import { handlePairingAuthorisationMessage } from './multidevice';
import {
  MediumGroupRequestKeysMessage,
  ReceiptMessage,
} from '../session/messages/outgoing';
import { MultiDeviceProtocol, SessionProtocol } from '../session/protocols';
import { PubKey } from '../session/types';

import { handleSyncMessage } from './syncMessages';
import { onError } from './errors';
import ByteBuffer from 'bytebuffer';
import { BlockedNumberController } from '../util/blockedNumberController';

export async function handleContentMessage(envelope: EnvelopePlus) {
  const plaintext = await decrypt(envelope, envelope.content);

  if (!plaintext) {
    window.log.warn('handleContentMessage: plaintext was falsey');
    return;
  } else if (plaintext instanceof ArrayBuffer && plaintext.byteLength === 0) {
    return;
  }
  await innerHandleContentMessage(envelope, plaintext);
}

async function decryptForMediumGroup(
  envelope: EnvelopePlus,
  ciphertextObj: ArrayBuffer
) {
  const { dcodeIO, libloki } = window;

  const groupId = envelope.source;

  const identity = await window.Signal.Data.getIdentityKeyById(groupId);
  const secretKeyHex = identity.secretKey;

  if (!secretKeyHex) {
    throw new Error(`Secret key is empty for group ${groupId}!`);
  }

  const { senderIdentity } = envelope;

  const {
    ciphertext: outerCiphertext,
    ephemeralKey,
  } = SignalService.MediumGroupContent.decode(new Uint8Array(ciphertextObj));

  const ephemKey = ephemeralKey.buffer;
  const secretKey = dcodeIO.ByteBuffer.wrap(
    secretKeyHex,
    'hex'
  ).toArrayBuffer();

  const mediumGroupCiphertext = await libloki.crypto.decryptForPubkey(
    secretKey,
    ephemKey,
    outerCiphertext.buffer
  );

  const { ciphertext, keyIdx } = SignalService.MediumGroupCiphertext.decode(
    mediumGroupCiphertext
  );

  const plaintext = await window.SenderKeyAPI.decryptWithSenderKey(
    ciphertext.buffer,
    keyIdx,
    groupId,
    senderIdentity
  );

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
  const primary = await MultiDeviceProtocol.getPrimaryDevice(number);
  return (
    BlockedNumberController.isBlocked(primary) ||
    BlockedNumberController.isBlocked(number)
  );
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
  const { textsecure } = window;

  window.log.info('received unidentified sender message');

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
      // tslint:disable-next-line: no-shadowed-variable
      const blocked = await isBlocked(source.getName());
      if (blocked) {
        await BlockedNumberController.block(source.getName());
        window.log.info(
          'Dropping blocked message with error after sealed sender decryption'
        );
        return null;
      }

      // eslint-disable-next-line no-param-reassign
      envelope.source = source.getName();
      // eslint-disable-next-line no-param-reassign
      envelope.sourceDevice = source.getDeviceId();
      // eslint-disable-next-line no-param-reassign
      envelope.unidentifiedDeliveryReceived = !originalSource;

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
  if (type === SignalService.Envelope.Type.SESSION_REQUEST) {
    // eslint-disable-next-line no-param-reassign
    envelope.type = SignalService.Envelope.Type.SESSION_REQUEST;
  }

  const blocked = await isBlocked(sender.getName());
  if (blocked) {
    await BlockedNumberController.block(sender.getName());
    window.log.info('Dropping blocked message after sealed sender decryption');
    return null;
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
    case SignalService.Envelope.Type.SESSION_REQUEST: {
      window.log.info('session-request message from ', envelope.source);

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
      const senderPubKey = new PubKey(senderIdentity);
      // tslint:disable-next-line no-floating-promises
      libsession.getMessageQueue().send(senderPubKey, requestKeysMessage);

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

export async function innerHandleContentMessage(
  envelope: EnvelopePlus,
  plaintext: ArrayBuffer
): Promise<void> {
  const { ConversationController } = window;

  const content = SignalService.Content.decode(new Uint8Array(plaintext));

  const { SESSION_REQUEST } = SignalService.Envelope.Type;

  await ConversationController.getOrCreateAndWait(envelope.source, 'private');

  if (envelope.type === SESSION_REQUEST) {
    await handleSessionRequestMessage(envelope, content);
  } else {
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
    // Are we not supposed to await here?
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
    await handleTypingMessage(envelope, content.typingMessage);
    return;
  }

  return;
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
      const promise = onDeliveryReceipt(envelope.source, toNumber(ts));
      results.push(promise);
    }
  } else if (type === SignalService.ReceiptMessage.Type.READ) {
    for (const ts of timestamp) {
      const promise = onReadReceipt(
        toNumber(envelope.timestamp),
        toNumber(ts),
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
    const envelopeTimestamp = toNumber(envelope.timestamp);
    const typingTimestamp = toNumber(timestamp);

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
  const user = PubKey.from(source);
  const primaryDevice = user
    ? await MultiDeviceProtocol.getPrimaryDevice(user)
    : null;

  const convoId = groupId || (primaryDevice && primaryDevice.key) || source;

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
