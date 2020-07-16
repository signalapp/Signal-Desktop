import { SignalService } from '../protobuf';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';
import { MediumGroupResponseKeysMessage } from '../session/messages/outgoing';
import { getMessageQueue } from '../session';
import { PubKey } from '../session/types';
import _ from 'lodash';

import * as SenderKeyAPI from '../session/medium_group';
import { StringUtils } from '../session/utils';

async function handleSenderKeyRequest(
  envelope: EnvelopePlus,
  groupUpdate: any
) {
  const { StringView, textsecure, log } = window;

  const senderIdentity = envelope.source;
  const ourIdentity = await textsecure.storage.user.getNumber();
  const { groupId } = groupUpdate;

  log.debug('[sender key] sender key request from:', senderIdentity);

  // We reuse the same message type for sender keys
  const { chainKey, keyIdx } = await SenderKeyAPI.getChainKey(
    groupId,
    ourIdentity
  );

  const chainKeyHex = StringView.arrayBufferToHex(chainKey);
  const responseParams = {
    timestamp: Date.now(),
    groupId,
    senderKey: {
      chainKey: chainKeyHex,
      keyIdx,
      pubKey: ourIdentity,
    },
  };

  const keysResponseMessage = new MediumGroupResponseKeysMessage(
    responseParams
  );

  const senderPubKey = new PubKey(senderIdentity);
  await getMessageQueue().send(senderPubKey, keysResponseMessage);

  await removeFromCache(envelope);
}

async function handleSenderKey(envelope: EnvelopePlus, groupUpdate: any) {
  const { log } = window;
  const { groupId, senderKey } = groupUpdate;
  const senderIdentity = envelope.source;

  log.debug('[sender key] got a new sender key from:', senderIdentity);

  await SenderKeyAPI.saveSenderKeys(
    groupId,
    PubKey.cast(senderIdentity),
    senderKey.chainKey,
    senderKey.keyIdx
  );

  await removeFromCache(envelope);
}

async function handleNewGroup(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.MediumGroupUpdate
) {
  const { Whisper, log } = window;

  const senderIdentity = envelope.source;

  const {
    name,
    groupPublicKey,
    groupPrivateKey,
    members: membersBinary,
    admins: adminsBinary,
    senderKeys,
  } = groupUpdate;

  const groupId = StringUtils.decode(groupPublicKey, 'hex');
  const maybeConvo = await window.ConversationController.get(groupId);

  const members = membersBinary.map((pk: Uint8Array) =>
    StringUtils.decode(pk, 'hex')
  );

  const admins = adminsBinary.map((pk: Uint8Array) =>
    StringUtils.decode(pk, 'hex')
  );

  const groupExists = !!maybeConvo;
  const convo = groupExists
    ? maybeConvo
    : await window.ConversationController.getOrCreateAndWait(groupId, 'group');

  {
    // Add group update message
    const now = Date.now();
    const message = convo.messageCollection.add({
      conversationId: convo.id,
      type: 'incoming',
      sent_at: now,
      received_at: now,
      group_update: {
        name,
        members,
      },
    });

    const messageId = await window.Signal.Data.saveMessage(message.attributes, {
      Message: Whisper.Message,
    });
    message.set({ id: messageId });
  }

  if (groupExists) {
    // ***** Updating the group *****
    log.info('Received a group update for medium group:', groupId);

    // Check that the sender is admin (make sure it words with multidevice)
    const isAdmin = convo.get('groupAdmins').includes(senderIdentity);

    if (!isAdmin) {
      log.warn('Rejected attempt to update a group by non-admin');
      await removeFromCache(envelope);
      return;
    }

    convo.set('name', name);
    convo.set('members', members);

    // TODO: check that we are still in the group (when we enable deleting members)
    convo.saveChangesToDB();

    // Update other fields. Add a corresponding "update" message to the conversation
  } else {
    // ***** Creating a new group *****
    log.info('Received a new medium group:', groupId);

    // TODO: Check that we are even a part of this group?

    convo.set('is_medium_group', true);
    convo.set('active_at', Date.now());
    convo.set('name', name);
    convo.set('groupAdmins', admins);

    const secretKeyHex = StringUtils.decode(groupPrivateKey, 'hex');

    await window.Signal.Data.createOrUpdateIdentityKey({
      id: groupId,
      secretKey: secretKeyHex,
    });

    // Save everyone's ratchet key
    await Promise.all(
      senderKeys.map(async senderKey => {
        // Note that keyIndex is a number and 0 is considered a valid value:
        if (
          senderKey.chainKey &&
          senderKey.keyIndex !== undefined &&
          senderKey.publicKey
        ) {
          const pubKey = StringUtils.decode(senderKey.publicKey, 'hex');
          const chainKey = StringUtils.decode(senderKey.chainKey, 'hex');
          const keyIndex = senderKey.keyIndex as number;
          await SenderKeyAPI.saveSenderKeys(
            groupId,
            PubKey.cast(pubKey),
            chainKey,
            keyIndex
          );
        } else {
          log.error('Received invalid sender key');
        }
      })
    );

    window.SwarmPolling.addGroupId(PubKey.cast(groupId));
  }

  await removeFromCache(envelope);
}

export async function handleMediumGroupUpdate(
  envelope: EnvelopePlus,
  groupUpdate: any
) {
  const { type } = groupUpdate;
  const { Type } = SignalService.MediumGroupUpdate;

  if (type === Type.SENDER_KEY_REQUEST) {
    await handleSenderKeyRequest(envelope, groupUpdate);
  } else if (type === Type.SENDER_KEY) {
    await handleSenderKey(envelope, groupUpdate);
  } else if (type === Type.NEW) {
    await handleNewGroup(envelope, groupUpdate);
  }
}
