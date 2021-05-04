import { PubKey } from '../types';

import _ from 'lodash';

import { fromHex, fromHexToArray, toHex } from '../utils/String';
import { BlockedNumberController } from '../../util/blockedNumberController';
import { ConversationController } from '../conversations';
import {
  addClosedGroupEncryptionKeyPair,
  getIdentityKeyById,
  getLatestClosedGroupEncryptionKeyPair,
  removeAllClosedGroupEncryptionKeyPairs,
} from '../../../ts/data/data';
import uuid from 'uuid';
import { SignalService } from '../../protobuf';
import { generateCurve25519KeyPairWithoutPrefix } from '../crypto';
import { encryptUsingSessionProtocol } from '../crypto/MessageEncrypter';
import { ECKeyPair } from '../../receiver/keypairs';
import { UserUtils } from '../utils';
import { ClosedGroupMemberLeftMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMemberLeftMessage';
import { ConversationModel, ConversationTypeEnum } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { MessageModelType } from '../../models/messageType';
import { MessageController } from '../messages';
import { distributingClosedGroupEncryptionKeyPairs } from '../../receiver/closedGroups';
import { getMessageQueue } from '..';
import { ClosedGroupAddedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupEncryptionPairRequestMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairRequestMessage';
import { ClosedGroupNameChangeMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import { updateOpenGroupV1 } from '../../opengroup/opengroupV1/OpenGroup';
import { updateOpenGroupV2 } from '../../opengroup/opengroupV2/OpenGroupUpdate';

export interface GroupInfo {
  id: string;
  name: string;
  members: Array<string>; // Primary keys
  active?: boolean;
  expireTimer?: number | null;
  avatar?: any;
  color?: any; // what is this???
  blocked?: boolean;
  admins?: Array<string>;
  secretKey?: Uint8Array;
  weWereJustAdded?: boolean;
}

interface UpdatableGroupState {
  name: string;
  members: Array<string>;
}

export interface GroupDiff extends MemberChanges {
  newName?: string;
}

export interface MemberChanges {
  joiningMembers?: Array<string>;
  leavingMembers?: Array<string>;
}

export async function getGroupSecretKey(groupId: string): Promise<Uint8Array> {
  const groupIdentity = await getIdentityKeyById(groupId);
  if (!groupIdentity) {
    throw new Error(`Could not load secret key for group ${groupId}`);
  }

  const secretKey = groupIdentity.secretKey;

  if (!secretKey) {
    throw new Error(`Secret key not found in identity key record for group ${groupId}`);
  }

  return new Uint8Array(fromHex(secretKey));
}

// tslint:disable: max-func-body-length
// tslint:disable: cyclomatic-complexity
export async function initiateGroupUpdate(
  groupId: string,
  groupName: string,
  members: Array<string>,
  avatar: any
) {
  const convo = await ConversationController.getInstance().getOrCreateAndWait(
    groupId,
    ConversationTypeEnum.GROUP
  );

  if (convo.isPublic()) {
    if (convo.isOpenGroupV1()) {
      await updateOpenGroupV1(convo, groupName, avatar);
    } else {
      await updateOpenGroupV2(convo, groupName, avatar);
    }

    return;
  }
  const isMediumGroup = convo.isMediumGroup();

  if (!isMediumGroup) {
    throw new Error('Legacy group are not supported anymore.');
  }

  // do not give an admins field here. We don't want to be able to update admins and
  // updateOrCreateClosedGroup() will update them if given the choice.
  const groupDetails = {
    id: groupId,
    name: groupName,
    members,
    active: true,
    expireTimer: convo.get('expireTimer'),
    avatar,
  };

  const diff = buildGroupDiff(convo, groupDetails);

  await updateOrCreateClosedGroup(groupDetails);

  const updateObj: GroupInfo = {
    id: groupId,
    name: groupName,
    members,
    admins: convo.get('groupAdmins'),
    expireTimer: convo.get('expireTimer'),
  };

  if (diff.newName?.length) {
    const nameOnlyDiff: GroupDiff = { newName: diff.newName };
    const dbMessageName = await addUpdateMessage(convo, nameOnlyDiff, 'outgoing', Date.now());
    MessageController.getInstance().register(dbMessageName.id, dbMessageName);
    await sendNewName(convo, diff.newName, dbMessageName.id);
  }

  if (diff.joiningMembers?.length) {
    const joiningOnlyDiff: GroupDiff = { joiningMembers: diff.joiningMembers };
    const dbMessageAdded = await addUpdateMessage(convo, joiningOnlyDiff, 'outgoing', Date.now());
    MessageController.getInstance().register(dbMessageAdded.id, dbMessageAdded);
    await sendAddedMembers(convo, diff.joiningMembers, dbMessageAdded.id, updateObj);
  }

  if (diff.leavingMembers?.length) {
    const leavingOnlyDiff: GroupDiff = { leavingMembers: diff.leavingMembers };
    const dbMessageLeaving = await addUpdateMessage(convo, leavingOnlyDiff, 'outgoing', Date.now());
    MessageController.getInstance().register(dbMessageLeaving.id, dbMessageLeaving);
    const stillMembers = members;
    await sendRemovedMembers(convo, diff.leavingMembers, dbMessageLeaving.id, stillMembers);
  }
}

export async function addUpdateMessage(
  convo: ConversationModel,
  diff: GroupDiff,
  type: MessageModelType,
  sentAt: number
): Promise<MessageModel> {
  const groupUpdate: any = {};

  if (diff.newName) {
    groupUpdate.name = diff.newName;
  }

  if (diff.joiningMembers) {
    groupUpdate.joined = diff.joiningMembers;
  }

  if (diff.leavingMembers) {
    groupUpdate.left = diff.leavingMembers;
  }

  const now = Date.now();

  const unread = type === 'incoming';

  const message = await convo.addSingleMessage({
    conversationId: convo.get('id'),
    type,
    sent_at: sentAt,
    received_at: now,
    group_update: groupUpdate,
    unread: unread ? 1 : 0,
    expireTimer: 0,
  });

  if (unread) {
    // update the unreadCount for this convo
    const unreadCount = await convo.getUnreadCount();
    convo.set({
      unreadCount,
    });
    await convo.commit();
  }

  return message;
}

export function buildGroupDiff(convo: ConversationModel, update: UpdatableGroupState): GroupDiff {
  const groupDiff: GroupDiff = {};

  if (convo.get('name') !== update.name) {
    groupDiff.newName = update.name;
  }

  const oldMembers = convo.get('members');

  const addedMembers = _.difference(update.members, oldMembers);
  if (addedMembers.length > 0) {
    groupDiff.joiningMembers = addedMembers;
  }
  // Check if anyone got kicked:
  const removedMembers = _.difference(oldMembers, update.members);
  if (removedMembers.length > 0) {
    groupDiff.leavingMembers = removedMembers;
  }

  return groupDiff;
}

export async function updateOrCreateClosedGroup(details: GroupInfo) {
  const { id, weWereJustAdded } = details;

  const conversation = await ConversationController.getInstance().getOrCreateAndWait(
    id,
    ConversationTypeEnum.GROUP
  );

  const updates: any = {
    name: details.name,
    members: details.members,
    color: details.color,
    type: 'group',
    is_medium_group: true,
  };

  if (details.active) {
    const activeAt = conversation.get('active_at');

    // The idea is to make any new group show up in the left pane. If
    //   activeAt is null, then this group has been purposefully hidden.
    if (activeAt !== null) {
      updates.active_at = activeAt || Date.now();
      updates.timestamp = updates.active_at;
    }
    updates.left = false;
    updates.lastJoinedTimestamp = weWereJustAdded ? Date.now() : updates.active_at;
  } else {
    updates.left = true;
  }

  conversation.set(updates);

  // Update the conversation avatar only if new avatar exists and hash differs
  const { avatar } = details;
  if (avatar && avatar.data) {
    const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
      conversation.attributes,
      avatar.data,
      {
        writeNewAttachmentData: window.Signal.writeNewAttachmentData,
        deleteAttachmentData: window.Signal.deleteAttachmentData,
      }
    );
    conversation.set(newAttributes);
  }

  const isBlocked = details.blocked || false;
  if (conversation.isClosedGroup() || conversation.isMediumGroup()) {
    await BlockedNumberController.setGroupBlocked(conversation.id, isBlocked);
  }

  if (details.admins?.length) {
    await conversation.updateGroupAdmins(details.admins);
  }

  await conversation.commit();

  const { expireTimer } = details;

  if (expireTimer === undefined || typeof expireTimer !== 'number') {
    return;
  }
  const source = UserUtils.getOurPubKeyStrFromCache();
  await conversation.updateExpirationTimer(expireTimer, source, Date.now(), {
    fromSync: true,
  });
}

export async function leaveClosedGroup(groupId: string) {
  const convo = ConversationController.getInstance().get(groupId);

  if (!convo) {
    window.log.error('Cannot leave non-existing group');
    return;
  }
  const ourNumber = UserUtils.getOurPubKeyFromCache();
  const isCurrentUserAdmin = convo.get('groupAdmins')?.includes(ourNumber.key);

  const now = Date.now();
  let members: Array<string> = [];
  let admins: Array<string> = [];

  // if we are the admin, the group must be destroyed for every members
  if (isCurrentUserAdmin) {
    window.log.info('Admin left a closed group. We need to destroy it');
    convo.set({ left: true });
    members = [];
    admins = [];
  } else {
    // otherwise, just the exclude ourself from the members and trigger an update with this
    convo.set({ left: true });
    members = (convo.get('members') || []).filter((m: string) => m !== ourNumber.key);
    admins = convo.get('groupAdmins') || [];
  }
  convo.set({ members });
  convo.set({ groupAdmins: admins });
  await convo.commit();

  const dbMessage = await convo.addSingleMessage({
    group_update: { left: 'You' },
    conversationId: groupId,
    type: 'outgoing',
    sent_at: now,
    received_at: now,
    expireTimer: 0,
  });
  MessageController.getInstance().register(dbMessage.id, dbMessage);
  const existingExpireTimer = convo.get('expireTimer') || 0;
  // Send the update to the group
  const ourLeavingMessage = new ClosedGroupMemberLeftMessage({
    timestamp: Date.now(),
    groupId,
    identifier: dbMessage.id,
    expireTimer: existingExpireTimer,
  });

  window.log.info(`We are leaving the group ${groupId}. Sending our leaving message.`);
  // sent the message to the group and once done, remove everything related to this group
  window.SwarmPolling.removePubkey(groupId);
  await getMessageQueue().sendToGroup(ourLeavingMessage, async () => {
    window.log.info(`Leaving message sent ${groupId}. Removing everything related to this group.`);
    await removeAllClosedGroupEncryptionKeyPairs(groupId);
  });
}

async function sendNewName(convo: ConversationModel, name: string, messageId: string) {
  if (name.length === 0) {
    window.log.warn('No name given for group update. Skipping');
    return;
  }

  const groupId = convo.get('id');

  // Send the update to the group
  const nameChangeMessage = new ClosedGroupNameChangeMessage({
    timestamp: Date.now(),
    groupId,
    identifier: messageId,
    expireTimer: 0,
    name,
  });
  await getMessageQueue().sendToGroup(nameChangeMessage);
}

async function sendAddedMembers(
  convo: ConversationModel,
  addedMembers: Array<string>,
  messageId: string,
  groupUpdate: GroupInfo
) {
  if (!addedMembers?.length) {
    window.log.warn('No addedMembers given for group update. Skipping');
    return;
  }

  const { id: groupId, members, name: groupName } = groupUpdate;
  const admins = groupUpdate.admins || [];

  // Check preconditions
  const hexEncryptionKeyPair = await getLatestClosedGroupEncryptionKeyPair(groupId);
  if (!hexEncryptionKeyPair) {
    throw new Error("Couldn't get key pair for closed group");
  }

  const encryptionKeyPair = ECKeyPair.fromHexKeyPair(hexEncryptionKeyPair);
  const expireTimer = convo.get('expireTimer') || 0;

  // Send the Added Members message to the group (only members already in the group will get it)
  const closedGroupControlMessage = new ClosedGroupAddedMembersMessage({
    timestamp: Date.now(),
    groupId,
    addedMembers,
    identifier: messageId,
    expireTimer,
  });
  await getMessageQueue().sendToGroup(closedGroupControlMessage);

  // Send closed group update messages to any new members individually
  const newClosedGroupUpdate = new ClosedGroupNewMessage({
    timestamp: Date.now(),
    name: groupName,
    groupId,
    admins,
    members,
    keypair: encryptionKeyPair,
    identifier: messageId || uuid(),
    expireTimer,
  });

  const promises = addedMembers.map(async m => {
    await ConversationController.getInstance().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE);
    const memberPubKey = PubKey.cast(m);
    await getMessageQueue().sendToPubKey(memberPubKey, newClosedGroupUpdate);
  });
  await Promise.all(promises);
}

async function sendRemovedMembers(
  convo: ConversationModel,
  removedMembers: Array<string>,
  messageId: string,
  stillMembers: Array<string>
) {
  if (!removedMembers?.length) {
    window.log.warn('No removedMembers given for group update. Skipping');
    return;
  }
  const ourNumber = UserUtils.getOurPubKeyFromCache();
  const admins = convo.get('groupAdmins') || [];
  const groupId = convo.get('id');

  const isCurrentUserAdmin = admins.includes(ourNumber.key);
  const isUserLeaving = removedMembers.includes(ourNumber.key);
  if (isUserLeaving) {
    throw new Error('Cannot remove members and leave the group at the same time');
  }
  if (removedMembers.includes(admins[0]) && stillMembers.length !== 0) {
    throw new Error("Can't remove admin from closed group without removing everyone.");
  }
  const expireTimer = convo.get('expireTimer') || 0;

  // Send the update to the group and generate + distribute a new encryption key pair if needed
  const mainClosedGroupControlMessage = new ClosedGroupRemovedMembersMessage({
    timestamp: Date.now(),
    groupId,
    removedMembers,
    identifier: messageId,
    expireTimer,
  });
  // Send the group update, and only once sent, generate and distribute a new encryption key pair if needed
  await getMessageQueue().sendToGroup(mainClosedGroupControlMessage, async () => {
    if (isCurrentUserAdmin) {
      // we send the new encryption key only to members already here before the update
      window.log.info(
        `Sending group update: A user was removed from ${groupId} and we are the admin. Generating and sending a new EncryptionKeyPair`
      );

      await generateAndSendNewEncryptionKeyPair(groupId, stillMembers);
    }
  });
}

export async function generateAndSendNewEncryptionKeyPair(
  groupPublicKey: string,
  targetMembers: Array<string>
) {
  const groupConvo = ConversationController.getInstance().get(groupPublicKey);
  const groupId = fromHexToArray(groupPublicKey);

  if (!groupConvo) {
    window.log.warn('generateAndSendNewEncryptionKeyPair: conversation not found', groupPublicKey);
    return;
  }
  if (!groupConvo.isMediumGroup()) {
    window.log.warn(
      'generateAndSendNewEncryptionKeyPair: conversation not a closed group',
      groupPublicKey
    );
    return;
  }

  const ourNumber = UserUtils.getOurPubKeyFromCache();
  if (!groupConvo.get('groupAdmins')?.includes(ourNumber.key)) {
    window.log.warn('generateAndSendNewEncryptionKeyPair: cannot send it as a non admin');
    return;
  }

  // Generate the new encryption key pair
  const newKeyPair = await generateCurve25519KeyPairWithoutPrefix();

  if (!newKeyPair) {
    window.log.warn('generateAndSendNewEncryptionKeyPair: failed to generate new keypair');
    return;
  }
  // Distribute it
  const wrappers = await buildEncryptionKeyPairWrappers(targetMembers, newKeyPair);

  const expireTimer = groupConvo.get('expireTimer') || 0;

  const keypairsMessage = new ClosedGroupEncryptionPairMessage({
    groupId: toHex(groupId),
    timestamp: Date.now(),
    encryptedKeyPairs: wrappers,
    expireTimer,
  });

  distributingClosedGroupEncryptionKeyPairs.set(toHex(groupId), newKeyPair);

  const messageSentCallback = async () => {
    window.log.info(
      `KeyPairMessage for ClosedGroup ${groupPublicKey} is sent. Saving the new encryptionKeyPair.`
    );

    distributingClosedGroupEncryptionKeyPairs.delete(toHex(groupId));

    await addClosedGroupEncryptionKeyPair(toHex(groupId), newKeyPair.toHexKeyPair());
  };
  // this is to be sent to the group pubkey adress
  await getMessageQueue().sendToGroup(keypairsMessage, messageSentCallback);
}

export async function buildEncryptionKeyPairWrappers(
  targetMembers: Array<string>,
  encryptionKeyPair: ECKeyPair
) {
  if (
    !encryptionKeyPair ||
    !encryptionKeyPair.publicKeyData.length ||
    !encryptionKeyPair.privateKeyData.length
  ) {
    throw new Error('buildEncryptionKeyPairWrappers() needs a valid encryptionKeyPair set');
  }

  const proto = new SignalService.KeyPair({
    privateKey: encryptionKeyPair?.privateKeyData,
    publicKey: encryptionKeyPair?.publicKeyData,
  });
  const plaintext = SignalService.KeyPair.encode(proto).finish();

  const wrappers = await Promise.all(
    targetMembers.map(async pubkey => {
      const ciphertext = await encryptUsingSessionProtocol(PubKey.cast(pubkey), plaintext);
      return new SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper({
        encryptedKeyPair: ciphertext,
        publicKey: fromHexToArray(pubkey),
      });
    })
  );
  return wrappers;
}

export async function requestEncryptionKeyPair(groupPublicKey: string | PubKey) {
  if (!window.lokiFeatureFlags.useRequestEncryptionKeyPair) {
    throw new Error('useRequestEncryptionKeyPair is disabled');
  }

  const groupConvo = ConversationController.getInstance().get(PubKey.cast(groupPublicKey).key);

  if (!groupConvo) {
    window.log.warn(
      'requestEncryptionKeyPair: Trying to request encryption key pair from unknown group'
    );
    return;
  }

  const ourNumber = UserUtils.getOurPubKeyFromCache();
  if (!groupConvo.get('members').includes(ourNumber.key)) {
    window.log.info('requestEncryptionKeyPair: We are not a member of this group.');
    return;
  }
  const expireTimer = groupConvo.get('expireTimer') || 0;

  const ecRequestMessage = new ClosedGroupEncryptionPairRequestMessage({
    expireTimer,
    groupId: groupPublicKey,
    timestamp: Date.now(),
  });

  await getMessageQueue().sendToGroup(ecRequestMessage);
}
