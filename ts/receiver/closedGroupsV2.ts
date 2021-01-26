import { SignalService } from '../protobuf';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';
import { PubKey } from '../session/types';
import { toHex } from '../session/utils/String';
import { ConversationController } from '../session/conversations';
import * as ClosedGroupV2 from '../session/groupv2';
import { BlockedNumberController } from '../util';
import {
  generateClosedGroupV2PublicKey,
  generateCurve25519KeyPairWithoutPrefix,
} from '../session/crypto';
import { getMessageQueue } from '../session';
import { decryptWithSessionProtocol } from './contentMessage';
import * as Data from '../../js/modules/data';
import {
  ClosedGroupV2NewMessage,
  ClosedGroupV2NewMessageParams,
} from '../session/messages/outgoing/content/data/groupv2/ClosedGroupV2NewMessage';

import { ECKeyPair } from './keypairs';
import { getOurNumber } from '../session/utils/User';
import { UserUtils } from '../session/utils';

export async function handleClosedGroupV2(
  envelope: EnvelopePlus,
  groupUpdate: any
) {
  const { type } = groupUpdate;
  const { Type } = SignalService.DataMessage.ClosedGroupUpdateV2;

  if (BlockedNumberController.isGroupBlocked(PubKey.cast(envelope.source))) {
    window.log.warn('Message ignored; destined for blocked group');
    await removeFromCache(envelope);
    return;
  }

  if (type === Type.ENCRYPTION_KEY_PAIR) {
    await handleKeyPairClosedGroupV2(envelope, groupUpdate);
  } else if (type === Type.NEW) {
    await handleNewClosedGroupV2(envelope, groupUpdate);
  } else if (type === Type.UPDATE) {
    await handleUpdateClosedGroupV2(envelope, groupUpdate);
  } else {
    window.log.error('Unknown group update type v2: ', type);
  }
}

function sanityCheckNewGroupV2(
  groupUpdate: SignalService.DataMessage.ClosedGroupUpdateV2
): boolean {
  // for a new group message, we need everything to be set
  const { name, publicKey, members, admins, encryptionKeyPair } = groupUpdate;
  const { log } = window;

  if (!name?.length) {
    log.warn('groupUpdateV2: name is empty');
    return false;
  }

  if (!name?.length) {
    log.warn('groupUpdateV2: name is empty');
    return false;
  }

  if (!publicKey?.length) {
    log.warn('groupUpdateV2: publicKey is empty');
    return false;
  }

  const hexGroupPublicKey = toHex(publicKey);
  if (!PubKey.from(hexGroupPublicKey)) {
    log.warn(
      'groupUpdateV2: publicKey is not recognized as a valid pubkey',
      hexGroupPublicKey
    );
    return false;
  }

  if (!members?.length) {
    log.warn('groupUpdateV2: members is empty');
    return false;
  }

  if (members.some(m => m.length === 0)) {
    log.warn('groupUpdateV2: one of the member pubkey is empty');
    return false;
  }

  if (!admins?.length) {
    log.warn('groupUpdateV2: admins is empty');
    return false;
  }

  if (admins.some(a => a.length === 0)) {
    log.warn('groupUpdateV2: one of the admins pubkey is empty');
    return false;
  }

  if (!encryptionKeyPair?.publicKey?.length) {
    log.warn('groupUpdateV2: keypair publicKey is empty');
    return false;
  }

  if (!encryptionKeyPair?.privateKey?.length) {
    log.warn('groupUpdateV2: keypair privateKey is empty');
    return false;
  }
  return true;
}

async function handleNewClosedGroupV2(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupUpdateV2
) {
  const { log } = window;

  if (
    groupUpdate.type !== SignalService.DataMessage.ClosedGroupUpdateV2.Type.NEW
  ) {
    return;
  }
  if (!sanityCheckNewGroupV2(groupUpdate)) {
    log.warn('Sanity check for newGroupV2 failed, dropping the message...');
    await removeFromCache(envelope);
    return;
  }

  const {
    name,
    publicKey,
    members: membersAsData,
    admins: adminsAsData,
    encryptionKeyPair,
  } = groupUpdate;

  const groupId = toHex(publicKey);
  const members = membersAsData.map(toHex);
  const admins = adminsAsData.map(toHex);

  const ourPrimary = await UserUtils.getOurNumber();
  if (!members.includes(ourPrimary.key)) {
    log.info(
      'Got a new group message but apparently we are not a member of it. Dropping it.'
    );
    await removeFromCache(envelope);
    return;
  }
  // FIXME maybe we should handle an expiretimer here too? And on ClosedGroupV2 updates?

  const maybeConvo = ConversationController.getInstance().get(groupId);

  const groupExists = !!maybeConvo;

  if (groupExists) {
    if (
      maybeConvo &&
      (maybeConvo.get('isKickedFromGroup') || maybeConvo.get('left'))
    ) {
      // TODO: indicate that we've been re-invited
      // to the group if that is the case

      // Enable typing:
      maybeConvo.set('isKickedFromGroup', false);
      maybeConvo.set('left', false);
      maybeConvo.set('lastJoinedTimestamp', Date.now());
    } else {
      log.warn(
        'Ignoring a closed group v2 message of type NEW: the conversation already exists'
      );
      await removeFromCache(envelope);
      return;
    }
  }

  const convo =
    maybeConvo ||
    (await ConversationController.getInstance().getOrCreateAndWait(
      groupId,
      'group'
    ));
  // ***** Creating a new group *****
  log.info('Received a new ClosedGroupV2 of id:', groupId);

  await ClosedGroupV2.addUpdateMessage(
    convo,
    { newName: name, joiningMembers: members },
    'incoming'
  );

  convo.set('name', name);
  convo.set('members', members);
  // mark a closed group v2 as a medium group.
  // this field is used to poll for this groupPubKey on the swarm nodes, among other things
  convo.set('is_medium_group', true);
  convo.set('active_at', Date.now());
  convo.set('lastJoinedTimestamp', Date.now());

  // We only set group admins on group creation
  convo.set('groupAdmins', admins);
  await convo.commit();
  // sanity checks validate this
  // tslint:disable: no-non-null-assertion
  const ecKeyPair = new ECKeyPair(
    encryptionKeyPair!.publicKey,
    encryptionKeyPair!.privateKey
  );
  window.log.info(`Received a the encryptionKeyPair for new group ${groupId}`);

  await Data.addClosedGroupEncryptionKeyPair(groupId, ecKeyPair.toHexKeyPair());

  // start polling for this new group
  window.SwarmPolling.addGroupId(PubKey.cast(groupId));

  await removeFromCache(envelope);
}

async function handleUpdateClosedGroupV2(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupUpdateV2
) {
  if (
    groupUpdate.type !==
    SignalService.DataMessage.ClosedGroupUpdateV2.Type.UPDATE
  ) {
    return;
  }
  const { name, members: membersBinary } = groupUpdate;
  const { log } = window;

  // for a closed group v2 update message, the envelope.source is the groupPublicKey
  const groupPublicKey = envelope.source;

  const convo = ConversationController.getInstance().get(groupPublicKey);

  if (!convo) {
    log.warn(
      'Ignoring a closed group v2 update message (INFO) for a non-existing group'
    );
    await removeFromCache(envelope);
    return;
  }

  // Check that the message isn't from before the group was created
  let lastJoinedTimestamp = convo.get('lastJoinedTimestamp');
  // might happen for existing groups
  if (!lastJoinedTimestamp) {
    const aYearAgo = Date.now() - 1000 * 60 * 24 * 365;
    convo.set({
      lastJoinedTimestamp: aYearAgo,
    });
    lastJoinedTimestamp = aYearAgo;
  }

  if (envelope.timestamp <= lastJoinedTimestamp) {
    window.log.warn(
      'Got a group update with an older timestamp than when we joined this group last time. Dropping it'
    );
    await removeFromCache(envelope);
    return;
  }
  const curAdmins = convo.get('groupAdmins');

  // Check that the sender is a member of the group (before the update)
  const oldMembers = convo.get('members') || [];
  if (!oldMembers.includes(envelope.senderIdentity)) {
    log.error(
      `Error: closed group v2: ignoring closed group update message from non-member. ${envelope.senderIdentity} is not a current member.`
    );
    await removeFromCache(envelope);
    return;
  }

  // NOTE: admins cannot change with closed groups v2
  const members = membersBinary.map(toHex);
  const diff = ClosedGroupV2.buildGroupDiff(convo, { name, members });

  // Check whether we are still in the group
  const ourNumber = await UserUtils.getOurNumber();
  const wasCurrentUserRemoved = !members.includes(ourNumber.key);
  const isCurrentUserAdmin = curAdmins?.includes(ourNumber.key);

  if (wasCurrentUserRemoved) {
    if (isCurrentUserAdmin) {
      // cannot remove the admin from a v2 closed group
      log.info(
        'Dropping message trying to remove the admin (us) from a v2 closed group'
      );
      await removeFromCache(envelope);
      return;
    }
    await window.Signal.Data.removeAllClosedGroupEncryptionKeyPairs(
      groupPublicKey
    );
    convo.set('isKickedFromGroup', true);
    // Disable typing:
    window.SwarmPolling.removePubkey(groupPublicKey);
  } else {
    if (convo.get('isKickedFromGroup')) {
      // Enable typing:
      convo.set('isKickedFromGroup', false);
      convo.set('left', false);
      // Subscribe to this group id
      window.SwarmPolling.addGroupId(new PubKey(groupPublicKey));
    }
  }

  // Generate and distribute a new encryption key pair if needed
  const wasAnyUserRemoved =
    diff.leavingMembers && diff.leavingMembers.length > 0;
  if (wasAnyUserRemoved && isCurrentUserAdmin) {
    window.log.info(
      'Handling group update: A user was removed and we are the admin. Generating and sending a new ECKeyPair'
    );
    await ClosedGroupV2.generateAndSendNewEncryptionKeyPair(
      groupPublicKey,
      members
    );
  }

  // Only add update message if we have something to show
  if (
    diff.joiningMembers?.length ||
    diff.leavingMembers?.length ||
    diff.newName
  ) {
    await ClosedGroupV2.addUpdateMessage(convo, diff, 'incoming');
  }

  convo.set('name', name);
  convo.set('members', members);

  await convo.commit();

  await removeFromCache(envelope);
}

/**
 * This function is called when we get a message with the new encryption keypair for a closed group v2.
 * In this message, we have n-times the same keypair encoded with n being the number of current members.
 * One of that encoded keypair is the one for us. We need to find it, decode it, and save it for use with this group.
 */
async function handleKeyPairClosedGroupV2(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupUpdateV2
) {
  if (
    groupUpdate.type !==
    SignalService.DataMessage.ClosedGroupUpdateV2.Type.ENCRYPTION_KEY_PAIR
  ) {
    return;
  }
  const ourNumber = await UserUtils.getOurNumber();
  const groupPublicKey = envelope.source;
  const ourKeyPair = await UserUtils.getIdentityKeyPair();

  if (!ourKeyPair) {
    window.log.warn("Couldn't find user X25519 key pair.");
    await removeFromCache(envelope);
    return;
  }

  const groupConvo = ConversationController.getInstance().get(groupPublicKey);
  if (!groupConvo) {
    window.log.warn(
      `Ignoring closed group encryption key pair for nonexistent group. ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }
  if (!groupConvo.isMediumGroup()) {
    window.log.warn(
      `Ignoring closed group encryption key pair for nonexistent medium group. ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }
  if (!groupConvo.get('groupAdmins')?.includes(envelope.senderIdentity)) {
    window.log.warn(
      `Ignoring closed group encryption key pair from non-admin. ${groupPublicKey}: ${envelope.senderIdentity}`
    );
    await removeFromCache(envelope);
    return;
  }

  // Find our wrapper and decrypt it if possible
  const ourWrapper = groupUpdate.wrappers.find(
    w => toHex(w.publicKey) === ourNumber.key
  );
  if (!ourWrapper) {
    window.log.warn(
      `Couldn\'t find our wrapper in the encryption keypairs wrappers for group ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }
  let plaintext: Uint8Array;
  try {
    const buffer = await decryptWithSessionProtocol(
      envelope,
      ourWrapper.encryptedKeyPair,
      ECKeyPair.fromKeyPair(ourKeyPair)
    );
    if (!buffer || buffer.byteLength === 0) {
      throw new Error();
    }
    plaintext = new Uint8Array(buffer);
  } catch (e) {
    window.log.warn("Couldn't decrypt closed group encryption key pair.", e);
    await removeFromCache(envelope);
    return;
  }

  // Parse it
  let proto: SignalService.DataMessage.ClosedGroupUpdateV2.KeyPair;
  try {
    proto = SignalService.DataMessage.ClosedGroupUpdateV2.KeyPair.decode(
      plaintext
    );
    if (
      !proto ||
      proto.privateKey.length === 0 ||
      proto.publicKey.length === 0
    ) {
      throw new Error();
    }
  } catch (e) {
    window.log.warn("Couldn't parse closed group encryption key pair.");
    await removeFromCache(envelope);
    return;
  }

  let keyPair: ECKeyPair;
  try {
    keyPair = new ECKeyPair(proto.publicKey, proto.privateKey);
  } catch (e) {
    window.log.warn("Couldn't parse closed group encryption key pair.");
    await removeFromCache(envelope);
    return;
  }
  window.log.info(
    `Received a new encryptionKeyPair for group ${groupPublicKey}`
  );

  // Store it
  await Data.addClosedGroupEncryptionKeyPair(
    groupPublicKey,
    keyPair.toHexKeyPair()
  );
  await removeFromCache(envelope);
}

export async function createClosedGroupV2(
  groupName: string,
  members: Array<string>
) {
  const setOfMembers = new Set(members);

  const ourNumber = await getOurNumber();
  // Create Group Identity
  // Generate the key pair that'll be used for encryption and decryption
  // Generate the group's public key
  const groupPublicKey = await generateClosedGroupV2PublicKey();
  const encryptionKeyPair = await generateCurve25519KeyPairWithoutPrefix();
  if (!encryptionKeyPair) {
    throw new Error(
      'Could not create encryption keypair for new closed group v2'
    );
  }
  // Ensure the current uses' primary device is included in the member list
  setOfMembers.add(ourNumber.key);
  const listOfMembers = [...setOfMembers];

  // Create the group
  const convo = await ConversationController.getInstance().getOrCreateAndWait(
    groupPublicKey,
    'group'
  );

  const admins = [ourNumber.key];

  const groupDetails = {
    id: groupPublicKey,
    name: groupName,
    members: listOfMembers,
    admins,
    active: true,
    expireTimer: 0,
  };

  // used for UI only, adding of a message to remind who is in the group and the name of the group
  const groupDiff: ClosedGroupV2.GroupDiff = {
    newName: groupName,
    joiningMembers: listOfMembers,
  };

  const dbMessage = await ClosedGroupV2.addUpdateMessage(
    convo,
    groupDiff,
    'outgoing'
  );
  window.getMessageController().register(dbMessage.id, dbMessage);

  // be sure to call this before sending the message.
  // the sending pipeline needs to know from GroupUtils when a message is for a medium group
  await ClosedGroupV2.updateOrCreateClosedGroupV2(groupDetails);
  convo.set('lastJoinedTimestamp', Date.now());

  // Send a closed group update message to all members individually
  const promises = listOfMembers.map(async m => {
    const messageParams: ClosedGroupV2NewMessageParams = {
      groupId: groupPublicKey,
      name: groupName,
      members: listOfMembers,
      admins,
      keypair: encryptionKeyPair,
      timestamp: Date.now(),
      identifier: dbMessage.id,
      expireTimer: 0,
    };
    const message = new ClosedGroupV2NewMessage(messageParams);
    window.log.info(
      `Creating a new group and an encryptionKeyPair for group ${groupPublicKey}`
    );
    // tslint:disable-next-line: no-non-null-assertion
    await Data.addClosedGroupEncryptionKeyPair(
      groupPublicKey,
      encryptionKeyPair.toHexKeyPair()
    );
    return getMessageQueue().sendToPubKey(PubKey.cast(m), message);
  });

  // Subscribe to this group id
  window.SwarmPolling.addGroupId(new PubKey(groupPublicKey));

  await Promise.all(promises);

  window.inboxStore.dispatch(
    window.actionsCreators.openConversationExternal(groupPublicKey)
  );
}
