import { SignalService } from '../protobuf';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';
import { PubKey } from '../session/types';
import { toHex } from '../session/utils/String';
import { ConversationController } from '../session/conversations';
import * as ClosedGroup from '../session/group';
import { BlockedNumberController } from '../util';
import {
  generateClosedGroupPublicKey,
  generateCurve25519KeyPairWithoutPrefix,
} from '../session/crypto';
import { getMessageQueue } from '../session';
import { decryptWithSessionProtocol } from './contentMessage';
import {
  addClosedGroupEncryptionKeyPair,
  getAllEncryptionKeyPairsForGroup,
  getLatestClosedGroupEncryptionKeyPair,
  isKeyPairAlreadySaved,
  removeAllClosedGroupEncryptionKeyPairs,
} from '../../ts/data/data';
import {
  ClosedGroupNewMessage,
  ClosedGroupNewMessageParams,
} from '../session/messages/outgoing/content/data/group/ClosedGroupNewMessage';

import { ECKeyPair, HexKeyPair } from './keypairs';
import { UserUtils } from '../session/utils';
import { ConversationModel } from '../models/conversation';
import _ from 'lodash';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/syncUtils';
import { MessageController } from '../session/messages';
import { ClosedGroupEncryptionPairReplyMessage } from '../session/messages/outgoing/content/data/group';
import { queueAllCachedFromSource } from './receiver';

export const distributingClosedGroupEncryptionKeyPairs = new Map<
  string,
  ECKeyPair
>();

export async function handleClosedGroupControlMessage(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage
) {
  const { type } = groupUpdate;
  const { Type } = SignalService.DataMessage.ClosedGroupControlMessage;
  window.log.info(
    ` handle closed group update from ${envelope.senderIdentity} about group ${envelope.source}`
  );

  if (BlockedNumberController.isGroupBlocked(PubKey.cast(envelope.source))) {
    window.log.warn('Message ignored; destined for blocked group');
    await removeFromCache(envelope);
    return;
  }
  // We drop New closed group message from our other devices, as they will come as ConfigurationMessage instead
  if (type === Type.ENCRYPTION_KEY_PAIR) {
    const isComingFromGroupPubkey =
      envelope.type === SignalService.Envelope.Type.CLOSED_GROUP_CIPHERTEXT;
    await handleClosedGroupEncryptionKeyPair(
      envelope,
      groupUpdate,
      isComingFromGroupPubkey
    );
  } else if (type === Type.NEW) {
    await handleNewClosedGroup(envelope, groupUpdate);
  } else if (
    type === Type.NAME_CHANGE ||
    type === Type.MEMBERS_REMOVED ||
    type === Type.MEMBERS_ADDED ||
    type === Type.MEMBER_LEFT ||
    type === Type.ENCRYPTION_KEY_PAIR_REQUEST ||
    type === Type.UPDATE
  ) {
    await performIfValid(envelope, groupUpdate);
  } else {
    window.log.error('Unknown group update type: ', type);
  }
}

function sanityCheckNewGroup(
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage
): boolean {
  // for a new group message, we need everything to be set
  const { name, publicKey, members, admins, encryptionKeyPair } = groupUpdate;
  const { log } = window;

  if (!name?.length) {
    log.warn('groupUpdate: name is empty');
    return false;
  }

  if (!name?.length) {
    log.warn('groupUpdate: name is empty');
    return false;
  }

  if (!publicKey?.length) {
    log.warn('groupUpdate: publicKey is empty');
    return false;
  }

  const hexGroupPublicKey = toHex(publicKey);
  if (!PubKey.from(hexGroupPublicKey)) {
    log.warn(
      'groupUpdate: publicKey is not recognized as a valid pubkey',
      hexGroupPublicKey
    );
    return false;
  }

  if (!members?.length) {
    log.warn('groupUpdate: members is empty');
    return false;
  }

  if (members.some(m => m.length === 0)) {
    log.warn('groupUpdate: one of the member pubkey is empty');
    return false;
  }

  if (!admins?.length) {
    log.warn('groupUpdate: admins is empty');
    return false;
  }

  if (admins.some(a => a.length === 0)) {
    log.warn('groupUpdate: one of the admins pubkey is empty');
    return false;
  }

  if (!encryptionKeyPair?.publicKey?.length) {
    log.warn('groupUpdate: keypair publicKey is empty');
    return false;
  }

  if (!encryptionKeyPair?.privateKey?.length) {
    log.warn('groupUpdate: keypair privateKey is empty');
    return false;
  }
  return true;
}

export async function handleNewClosedGroup(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage
) {
  const { log } = window;

  if (
    groupUpdate.type !==
    SignalService.DataMessage.ClosedGroupControlMessage.Type.NEW
  ) {
    return;
  }
  if (!sanityCheckNewGroup(groupUpdate)) {
    log.warn('Sanity check for newGroup failed, dropping the message...');
    await removeFromCache(envelope);
    return;
  }
  const ourNumber = UserUtils.getOurPubKeyFromCache();

  if (envelope.senderIdentity === ourNumber.key) {
    window.log.warn(
      'Dropping new closed group updatemessage from our other device.'
    );
    return removeFromCache(envelope);
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

  if (!members.includes(ourNumber.key)) {
    log.info(
      'Got a new group message but apparently we are not a member of it. Dropping it.'
    );
    await removeFromCache(envelope);
    return;
  }
  // FIXME maybe we should handle an expiretimer here too? And on ClosedGroup updates?

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
        'Ignoring a closed group message of type NEW: the conversation already exists'
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
  log.info('Received a new ClosedGroup of id:', groupId);

  await ClosedGroup.addUpdateMessage(
    convo,
    { newName: name, joiningMembers: members },
    'incoming'
  );

  // We only set group admins on group creation
  const groupDetails = {
    id: groupId,
    name: name,
    members: members,
    admins,
    active: true,
  };

  // be sure to call this before sending the message.
  // the sending pipeline needs to know from GroupUtils when a message is for a medium group
  await ClosedGroup.updateOrCreateClosedGroup(groupDetails);

  await convo.commit();
  // sanity checks validate this
  // tslint:disable: no-non-null-assertion
  const ecKeyPair = new ECKeyPair(
    encryptionKeyPair!.publicKey,
    encryptionKeyPair!.privateKey
  );
  window.log.info(`Received a the encryptionKeyPair for new group ${groupId}`);

  await addClosedGroupEncryptionKeyPair(groupId, ecKeyPair.toHexKeyPair());

  // start polling for this new group
  window.SwarmPolling.addGroupId(PubKey.cast(groupId));

  await removeFromCache(envelope);
  // trigger decrypting of all this group messages we did not decrypt successfully yet.
  await queueAllCachedFromSource(groupId);
}

async function handleUpdateClosedGroup(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel
) {
  const { name, members: membersBinary } = groupUpdate;
  const { log } = window;

  // for a closed group update message, the envelope.source is the groupPublicKey
  const groupPublicKey = envelope.source;

  const curAdmins = convo.get('groupAdmins');

  // NOTE: admins cannot change with closed groups
  const members = membersBinary.map(toHex);
  const diff = ClosedGroup.buildGroupDiff(convo, { name, members });

  // Check whether we are still in the group
  const ourNumber = UserUtils.getOurPubKeyFromCache();
  const wasCurrentUserRemoved = !members.includes(ourNumber.key);
  const isCurrentUserAdmin = curAdmins?.includes(ourNumber.key);

  if (wasCurrentUserRemoved) {
    if (isCurrentUserAdmin) {
      // cannot remove the admin from a closed group
      log.info(
        'Dropping message trying to remove the admin (us) from a closed group'
      );
      await removeFromCache(envelope);
      return;
    }
    await removeAllClosedGroupEncryptionKeyPairs(groupPublicKey);
    // Disable typing:
    convo.set('isKickedFromGroup', true);
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
    await ClosedGroup.generateAndSendNewEncryptionKeyPair(
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
    await ClosedGroup.addUpdateMessage(convo, diff, 'incoming');
  }

  convo.set('name', name);
  convo.set('members', members);

  await convo.commit();
  convo.updateLastMessage();

  await removeFromCache(envelope);
}

/**
 * This function is called when we get a message with the new encryption keypair for a closed group.
 * In this message, we have n-times the same keypair encoded with n being the number of current members.
 * One of that encoded keypair is the one for us. We need to find it, decode it, and save it for use with this group.
 */
async function handleClosedGroupEncryptionKeyPair(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  isComingFromGroupPubkey: boolean
) {
  if (
    groupUpdate.type !==
    SignalService.DataMessage.ClosedGroupControlMessage.Type.ENCRYPTION_KEY_PAIR
  ) {
    return;
  }
  const ourNumber = UserUtils.getOurPubKeyFromCache();
  // groupUpdate.publicKey might be set. This is used to give an explicitGroupPublicKey for this update.
  const groupPublicKey = toHex(groupUpdate.publicKey) || envelope.source;

  // in the case of an encryption key pair coming as a reply to a request we made
  // senderIdentity will be unset as the message is not encoded for medium groups
  const sender = isComingFromGroupPubkey
    ? envelope.senderIdentity
    : envelope.source;
  window.log.info(
    `Got a group update for group ${groupPublicKey}, type: ENCRYPTION_KEY_PAIR`
  );
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
  if (!groupConvo.get('members')?.includes(sender)) {
    window.log.warn(
      `Ignoring closed group encryption key pair from non-member. ${groupPublicKey}: ${envelope.senderIdentity}`
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
  let proto: SignalService.KeyPair;
  try {
    proto = SignalService.KeyPair.decode(plaintext);
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

  // Store it if needed
  const newKeyPairInHex = keyPair.toHexKeyPair();

  const isKeyPairAlreadyHere = await isKeyPairAlreadySaved(
    groupPublicKey,
    newKeyPairInHex
  );

  if (isKeyPairAlreadyHere) {
    const existingKeyPairs = await getAllEncryptionKeyPairsForGroup(
      groupPublicKey
    );
    window.log.info('Dropping already saved keypair for group', groupPublicKey);
    await removeFromCache(envelope);
    return;
  }
  window.log.info('Got a new encryption keypair for group', groupPublicKey);

  await addClosedGroupEncryptionKeyPair(groupPublicKey, keyPair.toHexKeyPair());
  await removeFromCache(envelope);
  // trigger decrypting of all this group messages we did not decrypt successfully yet.
  await queueAllCachedFromSource(groupPublicKey);
}

async function performIfValid(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage
) {
  const { Type } = SignalService.DataMessage.ClosedGroupControlMessage;

  const groupPublicKey = envelope.source;
  const sender = envelope.senderIdentity;

  const convo = ConversationController.getInstance().get(groupPublicKey);
  if (!convo) {
    window.log.warn('dropping message for nonexistent group');
    return;
  }

  if (!convo) {
    window.log.warn(
      'Ignoring a closed group update message (INFO) for a non-existing group'
    );
    return removeFromCache(envelope);
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
      'Got a group update with an older timestamp than when we joined this group last time. Dropping it.'
    );
    return removeFromCache(envelope);
  }

  // Check that the sender is a member of the group (before the update)
  const oldMembers = convo.get('members') || [];
  if (!oldMembers.includes(sender)) {
    window.log.error(
      `Error: closed group: ignoring closed group update message from non-member. ${sender} is not a current member.`
    );
    await removeFromCache(envelope);
    return;
  }

  if (groupUpdate.type === Type.UPDATE) {
    window.log.warn(
      'Received a groupUpdate non explicit. This should not happen anymore.'
    );
    await handleUpdateClosedGroup(envelope, groupUpdate, convo);
  } else if (groupUpdate.type === Type.NAME_CHANGE) {
    await handleClosedGroupNameChanged(envelope, groupUpdate, convo);
  } else if (groupUpdate.type === Type.MEMBERS_ADDED) {
    await handleClosedGroupMembersAdded(envelope, groupUpdate, convo);
  } else if (groupUpdate.type === Type.MEMBERS_REMOVED) {
    await handleClosedGroupMembersRemoved(envelope, groupUpdate, convo);
  } else if (groupUpdate.type === Type.MEMBER_LEFT) {
    await handleClosedGroupMemberLeft(envelope, groupUpdate, convo);
  } else if (groupUpdate.type === Type.ENCRYPTION_KEY_PAIR_REQUEST) {
    if (window.lokiFeatureFlags.useRequestEncryptionKeyPair) {
      await handleClosedGroupEncryptionKeyPairRequest(
        envelope,
        groupUpdate,
        convo
      );
    } else {
      window.log.warn(
        'Received ENCRYPTION_KEY_PAIR_REQUEST message but it is not enabled for now.'
      );
      await removeFromCache(envelope);
    }
    // if you add a case here, remember to add it where performIfValid is called too.
  }

  return true;
}

async function handleClosedGroupNameChanged(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel
) {
  // Only add update message if we have something to show
  const newName = groupUpdate.name;
  window.log.info(
    `Got a group update for group ${envelope.source}, type: NAME_CHANGED`
  );

  if (newName !== convo.get('name')) {
    const groupDiff: ClosedGroup.GroupDiff = {
      newName,
    };
    await ClosedGroup.addUpdateMessage(convo, groupDiff, 'incoming');
    convo.set({ name: newName });
    convo.updateLastMessage();
    await convo.commit();
  }

  await removeFromCache(envelope);
}

async function handleClosedGroupMembersAdded(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel
) {
  const { members: addedMembersBinary } = groupUpdate;
  const addedMembers = (addedMembersBinary || []).map(toHex);
  const oldMembers = convo.get('members') || [];
  const membersNotAlreadyPresent = addedMembers.filter(
    m => !oldMembers.includes(m)
  );
  window.log.info(
    `Got a group update for group ${envelope.source}, type: MEMBERS_ADDED`
  );

  if (membersNotAlreadyPresent.length === 0) {
    window.log.info(
      'no new members in this group update compared to what we have already. Skipping update'
    );
    await removeFromCache(envelope);
    return;
  }

  if (await areWeAdmin(convo)) {
    await sendLatestKeyPairToUsers(
      envelope,
      convo,
      convo.id,
      membersNotAlreadyPresent
    );
  }

  const members = [...oldMembers, ...membersNotAlreadyPresent];
  // Only add update message if we have something to show

  const groupDiff: ClosedGroup.GroupDiff = {
    joiningMembers: membersNotAlreadyPresent,
  };
  await ClosedGroup.addUpdateMessage(convo, groupDiff, 'incoming');

  convo.set({ members });
  convo.updateLastMessage();
  await convo.commit();
  await removeFromCache(envelope);
}

async function areWeAdmin(groupConvo: ConversationModel) {
  if (!groupConvo) {
    throw new Error('areWeAdmin needs a convo');
  }

  const groupAdmins = groupConvo.get('groupAdmins');
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  return groupAdmins?.includes(ourNumber) || false;
}

async function handleClosedGroupMembersRemoved(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel
) {
  // Check that the admin wasn't removed
  const currentMembers = convo.get('members');
  // removedMembers are all members in the diff
  const removedMembers = groupUpdate.members.map(toHex);
  // effectivelyRemovedMembers are the members which where effectively on this group before the update
  // and is used for the group update message only
  const effectivelyRemovedMembers = removedMembers.filter(m =>
    currentMembers.includes(m)
  );
  const groupPubKey = envelope.source;
  window.log.info(
    `Got a group update for group ${envelope.source}, type: MEMBERS_REMOVED`
  );

  const membersAfterUpdate = _.difference(currentMembers, removedMembers);
  const groupAdmins = convo.get('groupAdmins');
  if (!groupAdmins?.length) {
    throw new Error('No admins found for closed group member removed update.');
  }
  const firstAdmin = groupAdmins[0];

  if (removedMembers.includes(firstAdmin)) {
    window.log.warn(
      'Ignoring invalid closed group update: trying to remove the admin.'
    );
    await removeFromCache(envelope);
    return;
  }

  // If the current user was removed:
  // • Stop polling for the group
  // • Remove the key pairs associated with the group
  const ourPubKey = UserUtils.getOurPubKeyFromCache();
  const wasCurrentUserRemoved = !membersAfterUpdate.includes(ourPubKey.key);
  if (wasCurrentUserRemoved) {
    await removeAllClosedGroupEncryptionKeyPairs(groupPubKey);
    // Disable typing:
    convo.set('isKickedFromGroup', true);
    window.SwarmPolling.removePubkey(groupPubKey);
  }
  // Generate and distribute a new encryption key pair if needed
  if (await areWeAdmin(convo)) {
    try {
      await ClosedGroup.generateAndSendNewEncryptionKeyPair(
        groupPubKey,
        membersAfterUpdate
      );
    } catch (e) {
      window.log.warn('Could not distribute new encryption keypair.');
    }
  }

  // Only add update message if we have something to show
  if (membersAfterUpdate.length !== currentMembers.length) {
    const groupDiff: ClosedGroup.GroupDiff = {
      leavingMembers: effectivelyRemovedMembers,
    };
    await ClosedGroup.addUpdateMessage(convo, groupDiff, 'incoming');
    convo.updateLastMessage();
  }

  // Update the group
  convo.set({ members: membersAfterUpdate });

  await convo.commit();
  await removeFromCache(envelope);
}

async function handleClosedGroupMemberLeft(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel
) {
  const sender = envelope.senderIdentity;
  const groupPublicKey = envelope.source;
  const didAdminLeave = convo.get('groupAdmins')?.includes(sender) || false;
  // If the admin leaves the group is disbanded
  // otherwise, we remove the sender from the list of current members in this group
  const oldMembers = convo.get('members') || [];
  const leftMemberWasPresent = oldMembers.includes(sender);
  const members = didAdminLeave ? [] : oldMembers.filter(s => s !== sender);

  // Show log if we sent this message ourself (from another device or not)
  if (UserUtils.isUsFromCache(sender)) {
    window.log.info('Got self-sent group update member left...');
  }
  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();

  // Generate and distribute a new encryption key pair if needed
  const isCurrentUserAdmin =
    convo.get('groupAdmins')?.includes(ourPubkey) || false;
  if (isCurrentUserAdmin && !!members.length) {
    await ClosedGroup.generateAndSendNewEncryptionKeyPair(
      groupPublicKey,
      members
    );
  }

  if (didAdminLeave) {
    await removeAllClosedGroupEncryptionKeyPairs(groupPublicKey);
    // Disable typing:
    convo.set('isKickedFromGroup', true);
    window.SwarmPolling.removePubkey(groupPublicKey);
  }

  // Only add update message if we have something to show
  if (leftMemberWasPresent) {
    const groupDiff: ClosedGroup.GroupDiff = {
      leavingMembers: didAdminLeave ? oldMembers : [sender],
    };
    await ClosedGroup.addUpdateMessage(convo, groupDiff, 'incoming');
    convo.updateLastMessage();
  }

  convo.set('members', members);

  await convo.commit();

  await removeFromCache(envelope);
}

async function sendLatestKeyPairToUsers(
  envelope: EnvelopePlus,
  groupConvo: ConversationModel,
  groupPubKey: string,
  targetUsers: Array<string>
) {
  // use the inMemory keypair if found
  const inMemoryKeyPair = distributingClosedGroupEncryptionKeyPairs.get(
    groupPubKey
  );

  // Get the latest encryption key pair
  const latestKeyPair = await getLatestClosedGroupEncryptionKeyPair(
    groupPubKey
  );
  if (!inMemoryKeyPair && !latestKeyPair) {
    window.log.info(
      'We do not have the keypair ourself, so dropping this message.'
    );
    return;
  }

  const keyPairToUse =
    inMemoryKeyPair || ECKeyPair.fromHexKeyPair(latestKeyPair as HexKeyPair);

  const expireTimer = groupConvo.get('expireTimer') || 0;

  await Promise.all(
    targetUsers.map(async member => {
      window.log.info(
        `Sending latest closed group encryption key pair to: ${member}`
      );
      await ConversationController.getInstance().getOrCreateAndWait(
        member,
        'private'
      );

      const wrappers = await ClosedGroup.buildEncryptionKeyPairWrappers(
        [member],
        keyPairToUse
      );

      const keypairsMessage = new ClosedGroupEncryptionPairReplyMessage({
        groupId: groupPubKey,
        timestamp: Date.now(),
        encryptedKeyPairs: wrappers,
        expireTimer,
      });

      // the encryption keypair is sent using established channels
      await getMessageQueue().sendToPubKey(
        PubKey.cast(member),
        keypairsMessage
      );
    })
  );
}

async function handleClosedGroupEncryptionKeyPairRequest(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  groupConvo: ConversationModel
) {
  if (!window.lokiFeatureFlags.useRequestEncryptionKeyPair) {
    throw new Error('useRequestEncryptionKeyPair is disabled');
  }
  const sender = envelope.senderIdentity;
  const groupPublicKey = envelope.source;
  // Guard against self-sends
  if (UserUtils.isUsFromCache(sender)) {
    window.log.info(
      'Dropping self send message of type ENCRYPTION_KEYPAIR_REQUEST'
    );
    await removeFromCache(envelope);
    return;
  }
  await sendLatestKeyPairToUsers(envelope, groupConvo, groupPublicKey, [
    sender,
  ]);
  return removeFromCache(envelope);
}

export async function createClosedGroup(
  groupName: string,
  members: Array<string>
) {
  const setOfMembers = new Set(members);

  const ourNumber = UserUtils.getOurPubKeyFromCache();
  // Create Group Identity
  // Generate the key pair that'll be used for encryption and decryption
  // Generate the group's public key
  const groupPublicKey = await generateClosedGroupPublicKey();
  const encryptionKeyPair = await generateCurve25519KeyPairWithoutPrefix();
  if (!encryptionKeyPair) {
    throw new Error('Could not create encryption keypair for new closed group');
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
  const groupDiff: ClosedGroup.GroupDiff = {
    newName: groupName,
    joiningMembers: listOfMembers,
  };

  const dbMessage = await ClosedGroup.addUpdateMessage(
    convo,
    groupDiff,
    'outgoing'
  );
  MessageController.getInstance().register(dbMessage.id, dbMessage);

  // be sure to call this before sending the message.
  // the sending pipeline needs to know from GroupUtils when a message is for a medium group
  await ClosedGroup.updateOrCreateClosedGroup(groupDetails);
  await convo.commit();
  convo.updateLastMessage();

  // Send a closed group update message to all members individually
  const promises = listOfMembers.map(async m => {
    const messageParams: ClosedGroupNewMessageParams = {
      groupId: groupPublicKey,
      name: groupName,
      members: listOfMembers,
      admins,
      keypair: encryptionKeyPair,
      timestamp: Date.now(),
      identifier: dbMessage.id,
      expireTimer: 0,
    };
    const message = new ClosedGroupNewMessage(messageParams);
    window.log.info(
      `Creating a new group and an encryptionKeyPair for group ${groupPublicKey}`
    );
    // tslint:disable-next-line: no-non-null-assertion
    await addClosedGroupEncryptionKeyPair(
      groupPublicKey,
      encryptionKeyPair.toHexKeyPair()
    );
    return getMessageQueue().sendToPubKey(PubKey.cast(m), message);
  });

  // Subscribe to this group id
  window.SwarmPolling.addGroupId(new PubKey(groupPublicKey));

  await Promise.all(promises);

  await forceSyncConfigurationNowIfNeeded();

  window.inboxStore.dispatch(
    window.actionsCreators.openConversationExternal(groupPublicKey)
  );
}
