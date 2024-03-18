import _, { isNumber, toNumber } from 'lodash';

import { Data } from '../data/data';
import { SignalService } from '../protobuf';
import { getMessageQueue } from '../session';
import { getConversationController } from '../session/conversations';
import * as ClosedGroup from '../session/group/closed-group';
import { PubKey } from '../session/types';
import { toHex } from '../session/utils/String';
import { BlockedNumberController } from '../util';
import { removeFromCache } from './cache';
import { decryptWithSessionProtocol } from './contentMessage';
import { EnvelopePlus } from './types';

import { ConversationModel } from '../models/conversation';
import { ConversationTypeEnum } from '../models/conversationAttributes';

import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { GetNetworkTime } from '../session/apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../session/apis/snode_api/namespaces';
import { DisappearingMessageUpdate } from '../session/disappearing_messages/types';
import { ClosedGroupEncryptionPairReplyMessage } from '../session/messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairReplyMessage';
import { UserUtils } from '../session/utils';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { ReleasedFeatures } from '../util/releaseFeature';
import { Storage } from '../util/storage';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { ConfigWrapperObjectTypes } from '../webworker/workers/browser/libsession_worker_functions';
import { getSettingsKeyFromLibsessionWrapper } from './configMessage';
import { ECKeyPair, HexKeyPair } from './keypairs';
import { queueAllCachedFromSource } from './receiver';

export const distributingClosedGroupEncryptionKeyPairs = new Map<string, ECKeyPair>();

// this is a cache of the keypairs stored in the db.
const cacheOfClosedGroupKeyPairs: Map<string, Array<HexKeyPair>> = new Map();

export async function getAllCachedECKeyPair(groupPubKey: string) {
  let keyPairsFound = cacheOfClosedGroupKeyPairs.get(groupPubKey);

  if (!keyPairsFound || keyPairsFound.length === 0) {
    keyPairsFound = (await Data.getAllEncryptionKeyPairsForGroup(groupPubKey)) || [];
    cacheOfClosedGroupKeyPairs.set(groupPubKey, keyPairsFound);
  }

  return keyPairsFound.slice();
}

/**
 *
 * @returns true if this keypair was not already saved for this publickey
 */
export async function addKeyPairToCacheAndDBIfNeeded(
  groupPubKey: string,
  keyPair: HexKeyPair
): Promise<boolean> {
  const existingKeyPairs = await getAllCachedECKeyPair(groupPubKey);

  const alreadySaved = existingKeyPairs.some(k => {
    return k.privateHex === keyPair.privateHex && k.publicHex === keyPair.publicHex;
  });

  if (alreadySaved) {
    return false;
  }

  await Data.addClosedGroupEncryptionKeyPair(groupPubKey, keyPair);

  if (!cacheOfClosedGroupKeyPairs.has(groupPubKey)) {
    cacheOfClosedGroupKeyPairs.set(groupPubKey, []);
  }
  cacheOfClosedGroupKeyPairs.get(groupPubKey)?.push(keyPair);
  return true;
}

export async function removeAllClosedGroupEncryptionKeyPairs(groupPubKey: string) {
  cacheOfClosedGroupKeyPairs.set(groupPubKey, []);
  await Data.removeAllClosedGroupEncryptionKeyPairs(groupPubKey);
}

export async function handleClosedGroupControlMessage(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  expireUpdate: DisappearingMessageUpdate | null
) {
  const { type } = groupUpdate;
  const { Type } = SignalService.DataMessage.ClosedGroupControlMessage;
  window?.log?.info(
    `handle closed group update from ${envelope.senderIdentity || envelope.source} about group ${
      envelope.source
    }`
  );

  if (PubKey.isClosedGroupV3(envelope.source)) {
    window?.log?.warn(
      'Message ignored; closed group v3 updates cannot come from SignalService.DataMessage.ClosedGroupControlMessage '
    );
    await removeFromCache(envelope);
    return;
  }

  if (BlockedNumberController.isBlocked(PubKey.cast(envelope.source))) {
    window?.log?.warn('Message ignored; destined for blocked group');
    await removeFromCache(envelope);
    return;
  }

  // We drop New closed group message from our other devices, as they will come as ConfigurationMessage instead
  if (type === Type.ENCRYPTION_KEY_PAIR) {
    const isComingFromGroupPubkey =
      envelope.type === SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE;
    await handleClosedGroupEncryptionKeyPair(envelope, groupUpdate, isComingFromGroupPubkey);
    return;
  }
  if (type === Type.NEW) {
    if (
      !getConversationController()
        .get(envelope.senderIdentity || envelope.source)
        ?.isApproved()
    ) {
      window?.log?.info(
        'Received new closed group message from an unapproved sender -- dropping message.'
      );
      return;
    }
    await handleNewClosedGroup(envelope, groupUpdate);
    return;
  }

  if (
    type === Type.NAME_CHANGE ||
    type === Type.MEMBERS_REMOVED ||
    type === Type.MEMBERS_ADDED ||
    type === Type.MEMBER_LEFT ||
    type === Type.ENCRYPTION_KEY_PAIR_REQUEST
  ) {
    await performIfValid(envelope, groupUpdate, expireUpdate);
    return;
  }

  window?.log?.error('Unknown group update type: ', type);
  await removeFromCache(envelope);
}

function sanityCheckNewGroup(
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage
): boolean {
  // for a new group message, we need everything to be set
  const { name, publicKey, members, admins, encryptionKeyPair } = groupUpdate;

  if (!name?.length) {
    window?.log?.warn('groupUpdate: name is empty');
    return false;
  }

  if (!name?.length) {
    window?.log?.warn('groupUpdate: name is empty');
    return false;
  }

  if (!publicKey?.length) {
    window?.log?.warn('groupUpdate: publicKey is empty');
    return false;
  }

  const hexGroupPublicKey = toHex(publicKey);
  if (!PubKey.from(hexGroupPublicKey)) {
    window?.log?.warn(
      'groupUpdate: publicKey is not recognized as a valid pubkey',
      hexGroupPublicKey
    );
    return false;
  }

  if (PubKey.isClosedGroupV3(hexGroupPublicKey)) {
    window?.log?.warn('sanityCheckNewGroup: got a v3 new group as a ClosedGroupControlMessage. ');
    return false;
  }

  if (!members?.length) {
    window?.log?.warn('groupUpdate: members is empty');
    return false;
  }

  if (members.some(m => m.length === 0)) {
    window?.log?.warn('groupUpdate: one of the member pubkey is empty');
    return false;
  }

  if (!admins?.length) {
    window?.log?.warn('groupUpdate: admins is empty');
    return false;
  }

  if (admins.some(a => a.length === 0)) {
    window?.log?.warn('groupUpdate: one of the admins pubkey is empty');
    return false;
  }

  if (!encryptionKeyPair?.publicKey?.length) {
    window?.log?.warn('groupUpdate: keypair publicKey is empty');
    return false;
  }

  if (!encryptionKeyPair?.privateKey?.length) {
    window?.log?.warn('groupUpdate: keypair privateKey is empty');
    return false;
  }
  return true;
}

/**
 * If we merged a more recent wrapper, we must not apply the changes from some incoming messages as it would override a change already set in the wrapper.
 *
 * This is mostly to take care of the link a device logic, where we apply the changes from a wrapper, and then start polling from our swarm namespace 0.
 * Some messages on our swarm might unhide a contact which was marked hidden after that message was already received on another device. Same for groups left/joined etc.
 *
 * @returns true if the user config release is live AND the latest processed corresponding wrapper is supposed to have already included the changes this message did.
 * So if that message should not make any changes to the ata tracked in the wrappers (just add messages if needed, but don't set members, unhide contact etc).
 */
export async function sentAtMoreRecentThanWrapper(
  envelopeSentAtMs: number,
  variant: ConfigWrapperObjectTypes
): Promise<'unknown' | 'wrapper_more_recent' | 'envelope_more_recent'> {
  const userConfigReleased = await ReleasedFeatures.checkIsUserConfigFeatureReleased();
  if (!userConfigReleased) {
    return 'unknown';
  }

  const settingsKey = getSettingsKeyFromLibsessionWrapper(variant);
  if (!settingsKey) {
    return 'unknown';
  }
  const latestProcessedEnvelope = Storage.get(settingsKey);
  if (!isNumber(latestProcessedEnvelope) || !latestProcessedEnvelope) {
    // We want to process the message if we do not have valid data in the db.
    // Also, we DO want to process a message if we DO NOT have a latest processed timestamp for that wrapper yet
    return 'envelope_more_recent';
  }

  // this must return true if the message we are considering should have already been handled based on our `latestProcessedEnvelope`.
  // so if that message was sent before `latestProcessedEnvelope - 2 mins`, we must return true;
  const latestProcessedEnvelopeLess2Mins = latestProcessedEnvelope - 2 * 60 * 1000;

  return envelopeSentAtMs > latestProcessedEnvelopeLess2Mins
    ? 'envelope_more_recent'
    : 'wrapper_more_recent';
}

export async function handleNewClosedGroup(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage
) {
  if (groupUpdate.type !== SignalService.DataMessage.ClosedGroupControlMessage.Type.NEW) {
    return;
  }
  if (!sanityCheckNewGroup(groupUpdate)) {
    window?.log?.warn('Sanity check for newGroup failed, dropping the message...');
    await removeFromCache(envelope);
    return;
  }
  const ourNumber = UserUtils.getOurPubKeyFromCache();

  if (envelope.senderIdentity === ourNumber.key) {
    window?.log?.warn('Dropping new closed group updatemessage from our other device.');
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
  const envelopeTimestamp = toNumber(envelope.timestamp);
  // a type new is sent and received on one to one so do not use envelope.senderIdentity here
  const sender = envelope.source;
  if (
    (await sentAtMoreRecentThanWrapper(envelopeTimestamp, 'UserGroupsConfig')) ===
    'wrapper_more_recent'
  ) {
    // not from legacy config, so this is a new closed group deposited on our swarm by a user.
    // we do not want to process it if our wrapper is more recent that that invite to group envelope.
    window.log.info('dropping invite to legacy group because our wrapper is more recent');
    await removeFromCache(envelope);
    return;
  }

  if (!members.includes(ourNumber.key)) {
    window?.log?.info(
      'Got a new group message but apparently we are not a member of it. Dropping it.'
    );
    await removeFromCache(envelope);
    return;
  }
  const groupConvo = getConversationController().get(groupId);
  const expireTimer = groupUpdate.expirationTimer;

  if (groupConvo) {
    // if we did not left this group, just add the keypair we got if not already there
    if (!groupConvo.get('isKickedFromGroup') && !groupConvo.get('left')) {
      const ecKeyPairAlreadyExistingConvo = new ECKeyPair(
        encryptionKeyPair!.publicKey,
        encryptionKeyPair!.privateKey
      );
      await addKeyPairToCacheAndDBIfNeeded(groupId, ecKeyPairAlreadyExistingConvo.toHexKeyPair());

      // TODO This is only applicable for old closed groups - will be removed in future
      // TODO legacy messages support will be removed in a future release
      await groupConvo.updateExpireTimer({
        providedDisappearingMode:
          expireTimer === 0
            ? 'off'
            : ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()
              ? 'deleteAfterSend'
              : 'legacy',
        providedExpireTimer: expireTimer,
        providedSource: sender,
        receivedAt: GetNetworkTime.getNowWithNetworkOffset(),
        fromSync: false,
        fromCurrentDevice: false,
        fromConfigMessage: false,
      });

      await removeFromCache(envelope);
      return;
    }
    // convo exists and we left or got kicked, enable typing and continue processing
    // Enable typing:
    groupConvo.set({
      left: false,
      isKickedFromGroup: false,
      lastJoinedTimestamp: toNumber(envelope.timestamp),
      // we just got readded. Consider the zombie list to have been cleared
      zombies: [],
    });
  }

  const convo =
    groupConvo ||
    (await getConversationController().getOrCreateAndWait(groupId, ConversationTypeEnum.GROUP));
  // ***** Creating a new group *****
  window?.log?.info('Received a new ClosedGroup of id:', groupId);

  // we don't want the initial "AAA,BBB and You joined the group"

  // We only set group admins on group creation
  const groupDetails: ClosedGroup.GroupInfo = {
    id: groupId,
    name,
    members,
    admins,
    activeAt: envelopeTimestamp,
    expirationType: 'unknown',
    expireTimer: 0,
  };

  // be sure to call this before sending the message.
  // the sending pipeline needs to know from GroupUtils when a message is for a medium group
  await ClosedGroup.updateOrCreateClosedGroup(groupDetails);

  // ClosedGroup.updateOrCreateClosedGroup will mark the activeAt to Date.now if it's active
  // But we need to override this value with the sent timestamp of the message creating this group for us.
  // Having that timestamp set will allow us to pickup incoming group update which were sent between
  // envelope.timestamp and Date.now(). And we need to listen to those (some might even remove us)
  convo.set('lastJoinedTimestamp', envelopeTimestamp);
  convo.updateLastMessage();

  await convo.commit();

  const ecKeyPair = new ECKeyPair(encryptionKeyPair!.publicKey, encryptionKeyPair!.privateKey);
  window?.log?.info(`Received the encryptionKeyPair for new group ${groupId}`);

  await addKeyPairToCacheAndDBIfNeeded(groupId, ecKeyPair.toHexKeyPair());

  // start polling for this new group
  getSwarmPollingInstance().addGroupId(PubKey.cast(groupId));

  await removeFromCache(envelope);
  // trigger decrypting of all this group messages we did not decrypt successfully yet.
  await queueAllCachedFromSource(groupId);
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
  const sender = isComingFromGroupPubkey ? envelope.senderIdentity : envelope.source;
  window?.log?.info(`Got a group update for group ${groupPublicKey}, type: ENCRYPTION_KEY_PAIR`);
  const ourKeyPair = await UserUtils.getIdentityKeyPair();

  if (!ourKeyPair) {
    window?.log?.warn("Couldn't find user X25519 key pair.");
    await removeFromCache(envelope);
    return;
  }

  const groupConvo = getConversationController().get(groupPublicKey);
  if (!groupConvo) {
    window?.log?.warn(
      `Ignoring closed group encryption key pair for nonexistent group. ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }
  if (!groupConvo.isClosedGroup()) {
    window?.log?.warn(
      `Ignoring closed group encryption key pair for nonexistent medium group. ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }
  if (!groupConvo.get('groupAdmins')?.includes(sender)) {
    window?.log?.warn(
      `Ignoring closed group encryption key pair from non-admin. ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }

  // Find our wrapper and decrypt it if possible
  const ourWrapper = groupUpdate.wrappers.find(w => toHex(w.publicKey) === ourNumber.key);
  if (!ourWrapper) {
    window?.log?.warn(
      `Couldn't find our wrapper in the encryption keypairs wrappers for group ${groupPublicKey}`
    );
    await removeFromCache(envelope);
    return;
  }
  let plaintext: Uint8Array;
  try {
    perfStart(`encryptionKeyPair-${envelope.id}`);

    const buffer = await decryptWithSessionProtocol(
      envelope,
      ourWrapper.encryptedKeyPair,
      ECKeyPair.fromKeyPair(ourKeyPair)
    );
    perfEnd(`encryptionKeyPair-${envelope.id}`, 'encryptionKeyPair');

    if (!buffer || buffer.byteLength === 0) {
      throw new Error();
    }
    plaintext = new Uint8Array(buffer);
  } catch (e) {
    window?.log?.warn("Couldn't decrypt closed group encryption key pair.", e);
    await removeFromCache(envelope);
    return;
  }

  // Parse it
  let proto: SignalService.KeyPair;
  try {
    proto = SignalService.KeyPair.decode(plaintext);
    if (!proto || proto.privateKey.length === 0 || proto.publicKey.length === 0) {
      throw new Error();
    }
  } catch (e) {
    window?.log?.warn("Couldn't parse closed group encryption key pair.");
    await removeFromCache(envelope);
    return;
  }

  let keyPair: ECKeyPair;
  try {
    keyPair = new ECKeyPair(proto.publicKey, proto.privateKey);
  } catch (e) {
    window?.log?.warn("Couldn't parse closed group encryption key pair.");
    await removeFromCache(envelope);
    return;
  }
  window?.log?.info(`Received a new encryptionKeyPair for group ${groupPublicKey}`);

  // Store it if needed
  const newKeyPairInHex = keyPair.toHexKeyPair();

  const isKeyPairAlreadyHere = await addKeyPairToCacheAndDBIfNeeded(
    groupPublicKey,
    newKeyPairInHex
  );

  if (isKeyPairAlreadyHere) {
    window?.log?.info('Dropping already saved keypair for group', groupPublicKey);
    await removeFromCache(envelope);
    return;
  }
  window?.log?.info('Got a new encryption keypair for group', groupPublicKey);
  await removeFromCache(envelope);
  // trigger decrypting of all this group messages we did not decrypt successfully yet.
  await queueAllCachedFromSource(groupPublicKey);
}

async function performIfValid(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  expireUpdate: DisappearingMessageUpdate | null
) {
  const { Type } = SignalService.DataMessage.ClosedGroupControlMessage;

  const groupPublicKey = envelope.source;
  const sender = envelope.senderIdentity;

  if (PubKey.isClosedGroupV3(groupPublicKey)) {
    window?.log?.warn(
      'Message ignored; closed group v3 updates cannot come from SignalService.DataMessage.ClosedGroupControlMessage '
    );
    await removeFromCache(envelope);
    return;
  }

  const convo = getConversationController().get(groupPublicKey);
  if (!convo) {
    window?.log?.warn('dropping message for nonexistent group');
    await removeFromCache(envelope);
    return;
  }

  if (!convo) {
    window?.log?.warn('Ignoring a closed group update message (INFO) for a non-existing group');
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

  const envelopeTimestamp = toNumber(envelope.timestamp);
  if (envelopeTimestamp <= lastJoinedTimestamp) {
    window?.log?.warn(
      'Got a group update with an older timestamp than when we joined this group last time. Dropping it.'
    );
    await removeFromCache(envelope);
    return;
  }

  // Check that the sender is a member of the group (before the update)
  const oldMembers = convo.get('members') || [];
  if (!oldMembers.includes(sender)) {
    window?.log?.error(
      `Error: closed group: ignoring closed group update message from non-member. ${sender} is not a current member.`
    );
    await removeFromCache(envelope);
    return;
  }
  // make sure the conversation with this user exist (even if it's just hidden)
  await getConversationController().getOrCreateAndWait(sender, ConversationTypeEnum.PRIVATE);

  const moreRecentOrNah = await sentAtMoreRecentThanWrapper(envelopeTimestamp, 'UserGroupsConfig');
  const shouldNotApplyGroupChange = moreRecentOrNah === 'wrapper_more_recent';

  if (groupUpdate.type === Type.NAME_CHANGE) {
    await handleClosedGroupNameChanged(
      envelope,
      groupUpdate,
      convo,
      shouldNotApplyGroupChange,
      expireUpdate
    );
  } else if (groupUpdate.type === Type.MEMBERS_ADDED) {
    await handleClosedGroupMembersAdded(
      envelope,
      groupUpdate,
      convo,
      shouldNotApplyGroupChange,
      expireUpdate
    );
  } else if (groupUpdate.type === Type.MEMBERS_REMOVED) {
    await handleClosedGroupMembersRemoved(
      envelope,
      groupUpdate,
      convo,
      shouldNotApplyGroupChange,
      expireUpdate
    );
  } else if (groupUpdate.type === Type.MEMBER_LEFT) {
    await handleClosedGroupMemberLeft(envelope, convo, shouldNotApplyGroupChange, expireUpdate);
  } else if (groupUpdate.type === Type.ENCRYPTION_KEY_PAIR_REQUEST) {
    await removeFromCache(envelope);
  }
  // if you add a case here, remember to add it where performIfValid is called too.
}

async function handleClosedGroupNameChanged(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel,
  shouldOnlyAddUpdateMessage: boolean, // set this to true to not apply the change to the convo itself, just add the update in the conversation
  expireUpdate: DisappearingMessageUpdate | null
) {
  // Only add update message if we have something to show
  const newName = groupUpdate.name;
  window?.log?.info(`Got a group update for group ${envelope.source}, type: NAME_CHANGED`);

  if (newName !== convo.get('displayNameInProfile')) {
    const groupDiff: ClosedGroup.GroupDiff = {
      newName,
    };
    await ClosedGroup.addUpdateMessage({
      convo,
      diff: groupDiff,
      sender: envelope.senderIdentity,
      sentAt: toNumber(envelope.timestamp),
      expireUpdate,
    });
    if (!shouldOnlyAddUpdateMessage) {
      convo.set({ displayNameInProfile: newName });
    }
    convo.updateLastMessage();
    await convo.commit();
  }

  await removeFromCache(envelope);
}

async function handleClosedGroupMembersAdded(
  envelope: EnvelopePlus,
  groupUpdate: SignalService.DataMessage.ClosedGroupControlMessage,
  convo: ConversationModel,
  shouldOnlyAddUpdateMessage: boolean, // set this to true to not apply the change to the convo itself, just add the update in the conversation
  expireUpdate: DisappearingMessageUpdate | null
) {
  const { members: addedMembersBinary } = groupUpdate;
  const addedMembers = (addedMembersBinary || []).map(toHex);
  const oldMembers = convo.get('members') || [];
  const membersNotAlreadyPresent = addedMembers.filter(m => !oldMembers.includes(m));
  window?.log?.info(`Got a group update for group ${envelope.source}, type: MEMBERS_ADDED`);

  // make sure those members are not on our zombie list
  addedMembers.forEach(added => removeMemberFromZombies(envelope, PubKey.cast(added), convo));

  if (membersNotAlreadyPresent.length === 0) {
    window?.log?.info(
      'no new members in this group update compared to what we have already. Skipping update'
    );
    // this is just to make sure that the zombie list got written to the db.
    // if a member adds a member we have as a zombie, we consider that this member is not a zombie anymore
    await convo.commit();
    await removeFromCache(envelope);

    return;
  }

  // this is to avoid a race condition where a user gets removed and added back while the admin is offline
  if (await areWeAdmin(convo)) {
    await sendLatestKeyPairToUsers(convo, convo.id, membersNotAlreadyPresent);
  }

  const members = [...oldMembers, ...membersNotAlreadyPresent];
  // make sure the conversation with those members (even if it's just hidden)
  await Promise.all(
    members.map(async m =>
      getConversationController().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE)
    )
  );

  const groupDiff: ClosedGroup.GroupDiff = {
    joiningMembers: membersNotAlreadyPresent,
  };
  await ClosedGroup.addUpdateMessage({
    convo,
    diff: groupDiff,
    sender: envelope.senderIdentity,
    sentAt: toNumber(envelope.timestamp),
    expireUpdate,
  });

  if (!shouldOnlyAddUpdateMessage) {
    convo.set({ members });
  }

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
  convo: ConversationModel,
  shouldOnlyAddUpdateMessage: boolean, // set this to true to not apply the change to the convo itself, just add the update in the conversation
  expireUpdate: DisappearingMessageUpdate | null
) {
  // Check that the admin wasn't removed
  const currentMembers = convo.get('members');
  // removedMembers are all members in the diff
  const removedMembers = groupUpdate.members.map(toHex);
  // effectivelyRemovedMembers are the members which where effectively on this group before the update
  // and is used for the group update message only
  const effectivelyRemovedMembers = removedMembers.filter(m => currentMembers.includes(m));
  const groupPubKey = envelope.source;
  window?.log?.info(`Got a group update for group ${envelope.source}, type: MEMBERS_REMOVED`);

  const membersAfterUpdate = _.difference(currentMembers, removedMembers);
  const groupAdmins = convo.get('groupAdmins');
  if (!groupAdmins?.length) {
    throw new Error('No admins found for closed group member removed update.');
  }
  const firstAdmin = groupAdmins[0];

  if (removedMembers.includes(firstAdmin)) {
    window?.log?.warn('Ignoring invalid closed group update: trying to remove the admin.');
    await removeFromCache(envelope);
    throw new Error('Admins cannot be removed. They can only leave');
  }

  // The MEMBERS_REMOVED message type can only come from an admin.
  if (!groupAdmins.includes(envelope.senderIdentity)) {
    window?.log?.warn('Ignoring invalid closed group update. Only admins can remove members.');
    await removeFromCache(envelope);
    throw new Error('Only admins can remove members.');
  }

  // If the current user was removed:
  // • Stop polling for the group
  // • Remove the key pairs associated with the group
  const ourPubKey = UserUtils.getOurPubKeyFromCache();
  const wasCurrentUserKicked = !membersAfterUpdate.includes(ourPubKey.key);
  if (wasCurrentUserKicked) {
    // we now want to remove everything related to a group when we get kicked from it.
    await getConversationController().deleteClosedGroup(groupPubKey, {
      fromSyncMessage: false,
      sendLeaveMessage: false,
    });
  } else {
    // Note: we don't want to send a new encryption keypair when we get a member removed.
    // this is only happening when the admin gets a MEMBER_LEFT message

    // Only add update message if we have something to show
    if (membersAfterUpdate.length !== currentMembers.length) {
      const groupDiff: ClosedGroup.GroupDiff = {
        kickedMembers: effectivelyRemovedMembers,
      };
      await ClosedGroup.addUpdateMessage({
        convo,
        diff: groupDiff,
        sender: envelope.senderIdentity,
        sentAt: toNumber(envelope.timestamp),
        expireUpdate,
      });
      convo.updateLastMessage();
    }

    // Update the group
    const zombies = convo.get('zombies').filter(z => membersAfterUpdate.includes(z));

    if (!shouldOnlyAddUpdateMessage) {
      convo.set({ members: membersAfterUpdate });
      convo.set({ zombies });
    }
    await convo.commit();
  }
  await removeFromCache(envelope);
}

function isUserAZombie(convo: ConversationModel, user: PubKey) {
  return convo.get('zombies').includes(user.key);
}

/**
 * Returns true if the user was not a zombie and so was added to the zombies.
 * No commit() are called
 */
function addMemberToZombies(
  _envelope: EnvelopePlus,
  userToAdd: PubKey,
  convo: ConversationModel
): boolean {
  const zombies = convo.get('zombies');
  const isAlreadyZombie = isUserAZombie(convo, userToAdd);

  if (isAlreadyZombie) {
    return false;
  }
  convo.set('zombies', [...zombies, userToAdd.key]);
  return true;
}

/**
 *
 * Returns true if the user was not a zombie and so was not removed from the zombies.
 * Note: no commit() are made
 */
function removeMemberFromZombies(
  _envelope: EnvelopePlus,
  userToAdd: PubKey,
  convo: ConversationModel
): boolean {
  const zombies = convo.get('zombies');
  const isAlreadyAZombie = isUserAZombie(convo, userToAdd);

  if (!isAlreadyAZombie) {
    return false;
  }
  convo.set(
    'zombies',
    zombies.filter(z => z !== userToAdd.key)
  );
  return true;
}

async function handleClosedGroupAdminMemberLeft(groupPublicKey: string, envelope: EnvelopePlus) {
  // if the admin was remove and we are the admin, it can only be voluntary
  await getConversationController().deleteClosedGroup(groupPublicKey, {
    fromSyncMessage: false,
    sendLeaveMessage: false,
  });
  await removeFromCache(envelope);
}

async function handleClosedGroupLeftOurself(groupId: string, envelope: EnvelopePlus) {
  // if we ourself left. It can only mean that another of our device left the group and we just synced that message through the swarm
  await getConversationController().deleteClosedGroup(groupId, {
    fromSyncMessage: false,
    sendLeaveMessage: false,
  });
  await removeFromCache(envelope);
}

async function handleClosedGroupMemberLeft(
  envelope: EnvelopePlus,
  convo: ConversationModel,
  shouldOnlyAddUpdateMessage: boolean, // set this to true to not apply the change to the convo itself, just add the update in the conversation
  expireUpdate: DisappearingMessageUpdate | null
) {
  const sender = envelope.senderIdentity;
  const groupPublicKey = envelope.source;
  const didAdminLeave = convo.get('groupAdmins')?.includes(sender) || false;
  // If the admin leaves the group is disbanded
  // otherwise, we remove the sender from the list of current members in this group
  const oldMembers = convo.get('members') || [];
  const newMembers = oldMembers.filter(s => s !== sender);
  window?.log?.info(`Got a group update for group ${envelope.source}, type: MEMBER_LEFT`);

  // Show log if we sent this message ourself (from another device or not)
  if (UserUtils.isUsFromCache(sender)) {
    window?.log?.info('Got self-sent group update member left...');
  }
  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();

  // if the admin leaves, the group is disabled for everyone
  if (didAdminLeave) {
    await handleClosedGroupAdminMemberLeft(groupPublicKey, envelope);
    return;
  }

  // if we are no longer a member, we LEFT from another device
  if (!newMembers.includes(ourPubkey)) {
    // stop polling, remove everything from this closed group and the corresponding conversation
    await handleClosedGroupLeftOurself(groupPublicKey, envelope);
    return;
  }

  // Another member left, not us, not the admin, just another member.
  // But this member was in the list of members (as performIfValid checks for that)
  const groupDiff: ClosedGroup.GroupDiff = {
    leavingMembers: [sender],
  };

  await ClosedGroup.addUpdateMessage({
    convo,
    diff: groupDiff,
    sender: envelope.senderIdentity,
    sentAt: toNumber(envelope.timestamp),
    expireUpdate,
  });
  convo.updateLastMessage();
  // if a user just left and we are the admin, we remove him right away for everyone by sending a MEMBERS_REMOVED message so no need to add him as a zombie
  if (oldMembers.includes(sender)) {
    addMemberToZombies(envelope, PubKey.cast(sender), convo);
  }
  if (!shouldOnlyAddUpdateMessage) {
    convo.set('members', newMembers);
  }

  await convo.commit();

  await removeFromCache(envelope);
}

async function sendLatestKeyPairToUsers(
  _groupConvo: ConversationModel,
  groupPubKey: string,
  targetUsers: Array<string>
) {
  // use the inMemory keypair if found
  const inMemoryKeyPair = distributingClosedGroupEncryptionKeyPairs.get(groupPubKey);

  // Get the latest encryption key pair
  const latestKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(groupPubKey);
  if (!inMemoryKeyPair && !latestKeyPair) {
    window?.log?.info('We do not have the keypair ourself, so dropping this message.');
    return;
  }

  const keyPairToUse = inMemoryKeyPair || ECKeyPair.fromHexKeyPair(latestKeyPair as HexKeyPair);

  await Promise.all(
    targetUsers.map(async member => {
      window?.log?.info(`Sending latest closed group encryption key pair to: ${member}`);
      await getConversationController().getOrCreateAndWait(member, ConversationTypeEnum.PRIVATE);

      const wrappers = await ClosedGroup.buildEncryptionKeyPairWrappers([member], keyPairToUse);

      const keypairsMessage = new ClosedGroupEncryptionPairReplyMessage({
        groupId: groupPubKey,
        timestamp: Date.now(),
        encryptedKeyPairs: wrappers,
        expirationType: null, // we keep that one **not** expiring (not rendered in the clients, and we need it to be as available as possible on the swarm)
        expireTimer: null,
      });

      // the encryption keypair is sent using established channels
      await getMessageQueue().sendToPubKey(
        PubKey.cast(member),
        keypairsMessage,
        SnodeNamespaces.UserMessages
      );
    })
  );
}
