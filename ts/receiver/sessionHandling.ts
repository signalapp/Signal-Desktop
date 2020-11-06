import { EnvelopePlus } from './types';
import { SignalService } from '../protobuf';
import * as libsession from './../session';
import { toNumber } from 'lodash';
import { PubKey } from '../session/types';
import { SessionEstablishedMessage } from '../session/messages/outgoing';
import { SessionProtocol } from '../session/protocols';

export async function handleEndSession(number: string): Promise<void> {
  window.log.info('got end session');

  const { ConversationController } = window;

  try {
    const conversation = ConversationController.get(number);
    if (conversation) {
      // this just marks the conversation as being waiting for a new session
      // it does trigger a message to be sent. (the message is sent from handleSessionRequestMessage())
      await conversation.onSessionResetReceived();
    } else {
      throw new Error();
    }
  } catch (e) {
    window.log.error('Error getting conversation: ', number);
  }
}

export async function handleSessionRequestMessage(
  envelope: EnvelopePlus,
  preKeyBundleMessage: SignalService.IPreKeyBundleMessage
) {
  const { libsignal, StringView, textsecure, dcodeIO, log } = window;

  window.console.log(
    `Received SESSION_REQUEST from source: ${envelope.source}`
  );

  if (!preKeyBundleMessage) {
    log.warn('No pre-key bundle found in a session request');
    return;
  }

  const shouldProcessSessionRequest = await SessionProtocol.shouldProcessSessionRequest(
    new PubKey(envelope.source),
    toNumber(envelope.timestamp)
  );

  if (!shouldProcessSessionRequest) {
    log.debug('Ignoring a session request message');
    return;
  }
  try {
    // device id are always 1 with Session
    const deviceId = 1;
    const pubkey = envelope.source;
    const address = new libsignal.SignalProtocolAddress(
      envelope.source,
      deviceId
    );
    // we process the new prekeys and initiate a new session.
    // The old sessions will get deleted once the correspondant
    // has switch to the new session.
    const [identityKey, preKey, signedKey, signature] = [
      preKeyBundleMessage.identityKey,
      preKeyBundleMessage.preKey,
      preKeyBundleMessage.signedKey,
      preKeyBundleMessage.signature,
    ].map(k => dcodeIO.ByteBuffer.wrap(k).toArrayBuffer());
    const { preKeyId, signedKeyId } = preKeyBundleMessage;

    if (pubkey !== StringView.arrayBufferToHex(identityKey)) {
      throw new Error(
        'Error in savePreKeyBundleMessage: envelope pubkey does not match pubkey in prekey bundle'
      );
    }
    if (preKey === undefined || signedKey === undefined) {
      window.console.warn(
        "Couldn't process prekey bundle without preKey or signedKey"
      );
      return;
    }
    const signedPreKey = {
      keyId: signedKeyId,
      publicKey: signedKey,
      signature,
    };

    const preKeyObject = {
      publicKey: preKey,
      keyId: preKeyId,
    };

    const device = {
      identityKey,
      deviceId,
      preKey: preKeyObject,
      signedPreKey,
      registrationId: 0,
    };
    const builder = new libsignal.SessionBuilder(
      textsecure.storage.protocol,
      address
    );
    await builder.processPreKey(device);

    await SessionProtocol.onSessionRequestProcessed(
      new PubKey(envelope.source)
    );
    log.debug('sending session established to', envelope.source);
    // We don't need to await the call below because we just want to send it off

    const user = new PubKey(envelope.source);

    const sessionEstablished = new SessionEstablishedMessage({
      timestamp: Date.now(),
    });
    await libsession.getMessageQueue().send(user, sessionEstablished);
  } catch (e) {
    log.warn('Failed to process session request', e);
    // TODO how to handle a failed session request?
  }
}
