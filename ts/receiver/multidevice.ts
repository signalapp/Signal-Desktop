import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';

import * as Data from '../../js/modules/data';

import * as libsession from '../session';
import { SignalService } from '../protobuf';
import { updateProfile } from './receiver';
import { onVerified } from './syncMessages';

import { StringUtils } from '../session/utils';
import { MultiDeviceProtocol, SessionProtocol } from '../session/protocols';

async function unpairingRequestIsLegit(source: string, ourPubKey: string) {
  const { textsecure, storage, lokiFileServerAPI } = window;

  const isSecondary = textsecure.storage.get('isSecondaryDevice');
  if (!isSecondary) {
    return false;
  }
  const primaryPubKey = storage.get('primaryDevicePubKey');
  // TODO: allow unpairing from any paired device?
  if (source !== primaryPubKey) {
    return false;
  }

  const primaryMapping = await lokiFileServerAPI.getUserDeviceMapping(
    primaryPubKey
  );

  // If we don't have a mapping on the primary then we have been unlinked
  if (!primaryMapping) {
    return true;
  }

  // We expect the primary device to have updated its mapping
  // before sending the unpairing request
  const found = primaryMapping.authorisations.find(
    (authorisation: any) => authorisation.secondaryDevicePubKey === ourPubKey
  );

  // our pubkey should NOT be in the primary device mapping
  return !found;
}

async function clearAppAndRestart() {
  // remove our device mapping annotations from file server
  await window.lokiFileServerAPI.clearOurDeviceMappingAnnotations();
  // Delete the account and restart
  try {
    await window.Signal.Logs.deleteAll();
    await Data.removeAll();
    await Data.close();
    await Data.removeDB();
    await Data.removeOtherData();
    // TODO generate an empty db with a flag
    // to display a message about the unpairing
    // after the app restarts
  } catch (error) {
    window.log.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
  }
  window.restart();
}

export async function handleUnpairRequest(
  envelope: EnvelopePlus,
  ourPubKey: string
) {
  // TODO: move high-level pairing logic to libloki.multidevice.xx

  const legit = await unpairingRequestIsLegit(envelope.source, ourPubKey);

  await removeFromCache(envelope);
  if (legit) {
    await clearAppAndRestart();
  }
}

export async function handlePairingAuthorisationMessage(
  envelope: EnvelopePlus,
  pairingAuthorisation: SignalService.IPairingAuthorisationMessage,
  dataMessage: SignalService.IDataMessage,
  syncMessage: SignalService.ISyncMessage
): Promise<void> {
  const { secondaryDevicePubKey, grantSignature } = pairingAuthorisation;
  const isGrant =
    grantSignature &&
    secondaryDevicePubKey === window.textsecure.storage.user.getNumber();
  if (isGrant) {
    await handleAuthorisationForSelf(
      envelope,
      pairingAuthorisation,
      dataMessage,
      syncMessage
    );
  } else {
    await handlePairingRequest(envelope, pairingAuthorisation);
  }
}

async function handlePairingRequest(
  envelope: EnvelopePlus,
  pairingRequest: SignalService.IPairingAuthorisationMessage
) {
  const { libloki, Whisper } = window;

  const valid = await libloki.crypto.validateAuthorisation(pairingRequest);
  if (valid) {
    // Pairing dialog is open and is listening
    if (Whisper.events.isListenedTo('devicePairingRequestReceived')) {
      await MultiDeviceProtocol.savePairingAuthorisation(
        pairingRequest as Data.PairingAuthorisation
      );
      Whisper.events.trigger(
        'devicePairingRequestReceived',
        pairingRequest.secondaryDevicePubKey
      );
    } else {
      Whisper.events.trigger(
        'devicePairingRequestReceivedNoListener',
        pairingRequest.secondaryDevicePubKey
      );
    }
    // Ignore requests if the dialog is closed
  }
  await removeFromCache(envelope);
}

async function handleAuthorisationForSelf(
  envelope: EnvelopePlus,
  pairingAuthorisation: SignalService.IPairingAuthorisationMessage,
  dataMessage: SignalService.IDataMessage,
  syncMessage: SignalService.ISyncMessage
) {
  const { ConversationController, libloki, Whisper } = window;

  const valid = await libloki.crypto.validateAuthorisation(
    pairingAuthorisation
  );
  const alreadySecondaryDevice = !!window.storage.get('isSecondaryDevice');
  let removedFromCache = false;
  if (alreadySecondaryDevice) {
    window.log.warn(
      'Received an unexpected pairing authorisation (device is already paired as secondary device). Ignoring.'
    );
  } else if (!valid) {
    window.log.warn(
      'Received invalid pairing authorisation for self. Could not verify signature. Ignoring.'
    );
  } else {
    const { primaryDevicePubKey, grantSignature } = pairingAuthorisation;
    if (grantSignature) {
      // Authorisation received to become a secondary device
      window.log.info(
        `Received pairing authorisation from ${primaryDevicePubKey}`
      );
      // Set current device as secondary.
      // This will ensure the authorisation is sent
      // along with each session request.
      window.storage.remove('secondaryDeviceStatus');
      window.storage.put('isSecondaryDevice', true);
      window.storage.put('primaryDevicePubKey', primaryDevicePubKey);
      await MultiDeviceProtocol.savePairingAuthorisation(
        pairingAuthorisation as Data.PairingAuthorisation
      );
      const primaryConversation = await ConversationController.getOrCreateAndWait(
        primaryDevicePubKey,
        'private'
      );
      primaryConversation.trigger('change');
      Whisper.events.trigger('secondaryDeviceRegistration');
      // Update profile
      if (dataMessage) {
        const { profile, profileKey } = dataMessage;

        if (profile && profileKey) {
          const ourNumber = window.storage.get('primaryDevicePubKey');
          const me = window.ConversationController.get(ourNumber);
          if (me) {
            await updateProfile(me, profile, profileKey);
          }
        } else {
          window.log.warn('profile or profileKey are missing in DataMessage');
        }
      }
      // Update contact list
      if (syncMessage && syncMessage.contacts) {
        // Note: we do not return here because we don't want to block the next message on
        //   this attachment download and a lot of processing of that attachment.
        // This call already removes the envelope from the cache
        void handleContacts(envelope, syncMessage.contacts);
        removedFromCache = true;
      }
    } else {
      window.log.warn('Unimplemented pairing authorisation message type');
    }
  }
  if (!removedFromCache) {
    await removeFromCache(envelope);
  }
}

function parseContacts(arrbuf: ArrayBuffer): Array<any> {
  const buffer = new window.dcodeIO.ByteBuffer();
  buffer.append(arrbuf);
  buffer.offset = 0;
  buffer.limit = arrbuf.byteLength;

  const next = () => {
    try {
      if (buffer.limit === buffer.offset) {
        return undefined; // eof
      }
      const len = buffer.readInt32();
      const nextBuffer = buffer
        // tslint:disable-next-line restrict-plus-operands
        .slice(buffer.offset, buffer.offset + len)
        .toArrayBuffer();
      // TODO: de-dupe ByteBuffer.js includes in libaxo/libts
      // then remove this toArrayBuffer call.

      const proto: any = SignalService.ContactDetails.decode(
        new Uint8Array(nextBuffer)
      );

      buffer.skip(len);

      if (proto.avatar) {
        const attachmentLen = proto.avatar.length;
        proto.avatar.data = buffer
          // tslint:disable-next-line restrict-plus-operands
          .slice(buffer.offset, buffer.offset + attachmentLen)
          .toArrayBuffer();
        buffer.skip(attachmentLen);
      }

      if (proto.profileKey) {
        proto.profileKey = proto.profileKey.buffer;
      }

      return proto;
    } catch (error) {
      window.log.error(
        'ProtoParser.next error:',
        error && error.stack ? error.stack : error
      );
    }

    return null;
  };

  const results = [];
  let contactDetails = next();

  while (contactDetails) {
    results.push(contactDetails);
    contactDetails = next();
  }

  return results;
}

export async function handleContacts(
  envelope: EnvelopePlus,
  contacts: SignalService.SyncMessage.IContacts
) {
  window.log.info('contact sync');
  // const { blob } = contacts;

  const attachmentPointer = {
    contacts,
    data: window.dcodeIO.ByteBuffer.wrap(contacts.data).toArrayBuffer(), // ByteBuffer to ArrayBuffer
  };

  const contactDetails = parseContacts(attachmentPointer.data);

  await Promise.all(
    contactDetails.map(async (cd: any) => onContactReceived(cd))
  );

  // Not sure it `contactsync` even does anything at the moment
  // const ev = new Event('contactsync');
  // results.push(this.dispatchAndWait(ev));

  window.log.info('handleContacts: finished');
  await removeFromCache(envelope);
}

async function onContactReceived(details: any) {
  const {
    ConversationController,
    storage,
    textsecure,
    libloki,
    Whisper,
  } = window;
  const { Errors } = window.Signal.Types;

  const id = details.number;
  libloki.api.debug.logContactSync(
    'Got sync contact message with',
    id,
    ' details:',
    details
  );

  if (id === textsecure.storage.user.getNumber()) {
    // special case for syncing details about ourselves
    if (details.profileKey) {
      window.log.info('Got sync message with our own profile key');
      storage.put('profileKey', details.profileKey);
    }
  }

  const c = new Whisper.Conversation({ id });
  const validationError = c.validateNumber();
  if (validationError) {
    window.log.error(
      'Invalid contact received:',
      Errors.toLogFormat(validationError)
    );
    return;
  }

  try {
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'private'
    );
    let activeAt = conversation.get('active_at');

    // The idea is to make any new contact show up in the left pane. If
    //   activeAt is null, then this contact has been purposefully hidden.
    if (activeAt !== null) {
      activeAt = activeAt || Date.now();
    }
    const ourPrimaryKey = window.storage.get('primaryDevicePubKey');
    if (ourPrimaryKey) {
      const secondaryDevices = await MultiDeviceProtocol.getSecondaryDevices(
        ourPrimaryKey
      );
      if (secondaryDevices.some(device => device.key === id)) {
        await conversation.setSecondaryStatus(true, ourPrimaryKey);
      }
    }

    const devices = await MultiDeviceProtocol.getAllDevices(id);
    const deviceConversations = await Promise.all(
      devices.map(d =>
        ConversationController.getOrCreateAndWait(d.key, 'private')
      )
    );
    // triger session request with every devices of that user
    // when we do not have a session with it already
    deviceConversations.forEach(device => {
      // tslint:disable-next-line: no-floating-promises
      SessionProtocol.sendSessionRequestIfNeeded(
        new libsession.Types.PubKey(device.id)
      );
    });

    if (details.profileKey) {
      const profileKey = StringUtils.decode(details.profileKey, 'base64');
      conversation.setProfileKey(profileKey);
    }

    if (details.blocked !== 'undefined') {
      if (details.blocked) {
        storage.addBlockedNumber(id);
      } else {
        storage.removeBlockedNumber(id);
      }
    }

    // Do not set name to allow working with lokiProfile and nicknames
    conversation.set({
      // name: details.name,
      color: details.color,
      active_at: activeAt,
    });

    await conversation.setLokiProfile({ displayName: details.name });

    if (details.nickname) {
      await conversation.setNickname(details.nickname);
    }

    // Update the conversation avatar only if new avatar exists and hash differs
    const { avatar } = details;
    if (avatar && avatar.data) {
      const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
        conversation.attributes,
        avatar.data,
        {
          // This is some crazy inderection...
          writeNewAttachmentData: window.Signal.writeNewAttachmentData,
          deleteAttachmentData: window.Signal.deleteAttachmentData,
        }
      );
      conversation.set(newAttributes);
    }

    await window.Signal.Data.updateConversation(id, conversation.attributes, {
      Conversation: Whisper.Conversation,
    });
    const { expireTimer } = details;
    const isValidExpireTimer = typeof expireTimer === 'number';
    if (isValidExpireTimer) {
      const source = textsecure.storage.user.getNumber();
      const receivedAt = Date.now();

      await conversation.updateExpirationTimer(
        expireTimer,
        source,
        receivedAt,
        { fromSync: true }
      );
    }

    if (details.verified) {
      const { verified } = details;
      const verifiedEvent: any = {};
      verifiedEvent.verified = {
        state: verified.state,
        destination: verified.destination,
        identityKey: verified.identityKey.buffer,
      };
      verifiedEvent.viaContactSync = true;
      await onVerified(verifiedEvent);
    }
  } catch (error) {
    window.log.error('onContactReceived error:', Errors.toLogFormat(error));
  }
}
