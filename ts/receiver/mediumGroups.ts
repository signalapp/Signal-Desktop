import { SignalService } from '../protobuf';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';
import { MediumGroupResponseKeysMessage } from '../session/messages/outgoing';
import { getMessageQueue } from '../session';
import { PubKey } from '../session/types';
import _ from 'lodash';

import * as SenderKeyAPI from '../session/medium_group';
import { getChainKey } from '../session/medium_group/ratchet';
import { StringUtils } from '../session/utils';
import { BufferType } from '../session/utils/String';
import { ConversationModel } from '../../js/models/conversations';
import { UserUtil } from '../util';
import {
  createSenderKeyForGroup,
  RatchetState,
  shareSenderKeys,
} from '../session/medium_group/senderKeys';

const toHex = (d: BufferType) => StringUtils.decode(d, 'hex');
const fromHex = (d: string) => StringUtils.encode(d, 'hex');

async function handleSenderKeyRequest(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.MediumGroupUpdate
) {
  const { textsecure, log } = window;

  const senderIdentity = envelope.source;
  const ourIdentity = await textsecure.storage.user.getNumber();
  const { groupPublicKey } = groupUpdate;

  const groupId = toHex(groupPublicKey);

  log.debug('[sender key] sender key request from:', senderIdentity);

  const maybeKey = await getChainKey(groupId, ourIdentity);

  if (!maybeKey) {
    // Regenerate? This should never happen though
    log.error('Could not find own sender key');
    await removeFromCache(envelope);
    return;
  }

  // We reuse the same message type for sender keys
  const { chainKey, keyIdx } = maybeKey;

  // NOTE: we can't use `shareSenderKeys` here because
  // we are not using multidevice

  const responseParams = {
    timestamp: Date.now(),
    groupId,
    senderKey: {
      chainKey: new Uint8Array(chainKey),
      keyIdx,
      pubKey: new Uint8Array(fromHex(ourIdentity)),
    },
  };

  const keysResponseMessage = new MediumGroupResponseKeysMessage(
    responseParams
  );

  const senderPubKey = new PubKey(senderIdentity);
  await getMessageQueue().send(senderPubKey, keysResponseMessage);

  await removeFromCache(envelope);
}

async function handleSenderKey(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.MediumGroupUpdate
) {
  const { log } = window;
  const { groupPublicKey, senderKeys } = groupUpdate;
  const senderIdentity = envelope.source;

  const groupId = toHex(groupPublicKey);

  log.debug(
    '[sender key] got a new sender key from:',
    senderIdentity,
    'group:',
    groupId
  );

  await saveIncomingRatchetKeys(groupId, senderKeys);

  await removeFromCache(envelope);
}

async function saveIncomingRatchetKeys(
  groupId: string,
  ratchetKeys: Array<SignalService.MediumGroupUpdate.ISenderKey>
) {
  await Promise.all(
    ratchetKeys.map(async senderKey => {
      // Note that keyIndex is a number and 0 is considered a valid value:
      if (
        senderKey.chainKey &&
        senderKey.keyIndex !== undefined &&
        senderKey.publicKey
      ) {
        const pubKey = toHex(senderKey.publicKey);
        const chainKey = toHex(senderKey.chainKey);
        const keyIndex = senderKey.keyIndex as number;

        window.log.info('Saving sender keys for:', pubKey);

        // TODO: check that we are not overriting sender keys when
        // we are not expected to do so

        await SenderKeyAPI.saveSenderKeys(
          groupId,
          PubKey.cast(pubKey),
          chainKey,
          keyIndex
        );
      } else {
        window.log.error('Received invalid sender key');
      }
    })
  );
}

async function checkOwnSenderKeyPresent(
  senderKeys: Array<SignalService.MediumGroupUpdate.ISenderKey>
) {
  const ownKey = (await UserUtil.getCurrentDevicePubKey()) as string;
  const pubkeys = senderKeys
    .filter(key => key.publicKey && key.keyIndex !== undefined && key.chainKey)
    .map(key => toHex(key.publicKey as Uint8Array));

  if (pubkeys.indexOf(ownKey) === -1) {
    window.log.error(
      'Could not find sender key inside medium group invitation!'
    );
    // TODO: we should probably create the key ourselves in this case;
  }
}

async function handleNewGroup(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.MediumGroupUpdate
) {
  const { log } = window;

  const {
    name,
    groupPublicKey,
    groupPrivateKey,
    members: membersBinary,
    admins: adminsBinary,
    senderKeys,
  } = groupUpdate;

  const groupId = toHex(groupPublicKey);
  const members = membersBinary.map(toHex);
  const admins = adminsBinary.map(toHex);

  const maybeConvo = await window.ConversationController.get(groupId);

  const groupExists = !!maybeConvo;

  if (groupExists) {
    if (maybeConvo.get('isKickedFromGroup')) {
      // TODO: indicate that we've been re-invited
      // to the group if that is the case

      // Enable typing:
      maybeConvo.set('isKickedFromGroup', false);
      maybeConvo.set('left', false);
      maybeConvo.updateTextInputState();
    } else {
      log.warn(
        'Ignoring a medium group message of type NEW: the conversation already exists'
      );
      await removeFromCache(envelope);
      return;
    }
  }

  const convo =
    maybeConvo ||
    (await window.ConversationController.getOrCreateAndWait(groupId, 'group'));

  await SenderKeyAPI.addUpdateMessage(convo, { newName: name }, 'incoming');

  // ***** Creating a new group *****
  log.info('Received a new medium group:', groupId);

  // TODO: Check that we are even a part of this group

  convo.set('name', name);
  convo.set('members', members);
  convo.set('is_medium_group', true);
  convo.set('active_at', Date.now());

  // We only set group admins on group creation
  convo.set('groupAdmins', admins);

  convo.commit();

  const secretKeyHex = toHex(groupPrivateKey);

  await window.Signal.Data.createOrUpdateIdentityKey({
    id: groupId,
    secretKey: secretKeyHex,
  });

  // Sanity check: we expect to find our own sender key in the list
  await checkOwnSenderKeyPresent(senderKeys);

  await saveIncomingRatchetKeys(groupId, senderKeys);

  window.SwarmPolling.addGroupId(PubKey.cast(groupId));

  await removeFromCache(envelope);
}

function sanityCheckMediumGroupUpdate(
  primary: PubKey,
  diff: SenderKeyAPI.MemberChanges,
  groupUpdate: SignalService.MediumGroupUpdate
) {
  const joining = diff.joiningMembers || [];
  const leaving = diff.leavingMembers || [];

  // 1. When there are no member changes, we expect all sender keys
  if (!joining.length && !leaving.length) {
    if (groupUpdate.senderKeys.length !== groupUpdate.members.length) {
      window.log.error('Incorrect number of sender keys in group update');
    }
  }

  // 2. With leaving members, we expect keys for all members
  // (ignoring multidevice for now)
  if (leaving.length) {
    const stillMember = leaving.indexOf(primary.key) === -1;

    if (!stillMember) {
      // Should not receive any sender keys
      if (groupUpdate.senderKeys.length) {
        window.log.error('Unexpected sender keys for a leaving member');
      }
    } else if (groupUpdate.senderKeys.length < groupUpdate.members.length) {
      window.log.error('Too few sender keys in group update');
    }
  }
}

async function handleMediumGroupChange(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.MediumGroupUpdate
) {
  const {
    name,
    groupPublicKey,
    members: membersBinary,
    senderKeys,
  } = groupUpdate;
  const { log } = window;

  const groupId = toHex(groupPublicKey);

  const maybeConvo = await window.ConversationController.get(groupId);

  if (!maybeConvo) {
    log.warn(
      'Ignoring a medium group update message (INFO) for a non-existing group'
    );
    await removeFromCache(envelope);
    // TODO: In practice we probably need to be able to request the group's
    // the NEW message if we somehow missed the initial group invitation
    return;
  }

  const convo = maybeConvo as ConversationModel;

  // ***** Updating the group *****

  const curAdmins = convo.get('groupAdmins') || [];

  if (!curAdmins.length) {
    log.error('Error: medium group must have at least one admin');
    await removeFromCache(envelope);
    return;
  }

  // Check that the sender is admin (make sure it words with multidevice)
  const isAdmin = true;

  if (!isAdmin) {
    log.warn('Rejected attempt to update a group by non-admin');
    await removeFromCache(envelope);
    return;
  }

  // NOTE: right now, we don't expect admins to change
  // const admins = adminsBinary.map(toHex);
  const members = membersBinary.map(toHex);

  const diff = SenderKeyAPI.calculateGroupDiff(convo, { name, members });

  // Check whether we are still in the group
  const primary = await UserUtil.getPrimary();

  sanityCheckMediumGroupUpdate(primary, diff, groupUpdate);
  // console.log(`Got group update`, groupUpdate);
  await saveIncomingRatchetKeys(groupId, senderKeys);

  // Only add update message if we have something to show
  if (diff.joiningMembers || diff.leavingMembers || diff.newName) {
    await SenderKeyAPI.addUpdateMessage(convo, diff, 'incoming');
  }

  convo.set('name', name);
  convo.set('members', members);

  const areWeKicked = members.indexOf(primary.key) === -1;
  if (areWeKicked) {
    convo.set('isKickedFromGroup', true);
    // Disable typing:
    convo.updateTextInputState();
    window.SwarmPolling.removePubkey(groupId);
  }

  await convo.commit();

  if (diff.leavingMembers && diff.leavingMembers.length > 0) {
    // Send out the user's new ratchet to all members (minus the removed ones) using established channels
    const userSenderKey = await createSenderKeyForGroup(groupId, primary);
    window.log.warn(
      'Sharing our new senderKey with remainingMembers via message',
      members,
      userSenderKey
    );

    await shareSenderKeys(groupId, members, userSenderKey);
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
  } else if (type === Type.INFO) {
    await handleMediumGroupChange(envelope, groupUpdate);
  } else {
    window.log.error('Unknown group update type: ', type);
  }
}
