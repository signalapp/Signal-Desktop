import { PubKey } from '../types';
import * as Data from '../../../js/modules/data';
import _ from 'lodash';

import { MultiDeviceProtocol } from '../protocols';
import { fromHex, fromHexToArray, toHex } from '../utils/String';
import { UserUtil } from '../../util';
import { MessageModel, MessageModelType } from '../../../js/models/messages';
import { ConversationModel } from '../../../js/models/conversations';
import { BlockedNumberController } from '../../util/blockedNumberController';
import { ConversationController } from '../conversations';
import { updateOpenGroup } from '../../receiver/openGroups';
import { ECKeyPair } from '../../receiver/closedGroupsV2';
import { getMessageQueue } from '../instance';
import {
  ClosedGroupV2EncryptionPairMessage,
  ClosedGroupV2NewMessage,
  ClosedGroupV2UpdateMessage,
  ExpirationTimerUpdateMessage,
} from '../messages/outgoing';
import uuid from 'uuid';
import { SignalService } from '../../protobuf';
import { generateCurve25519KeyPairWithoutPrefix } from '../crypto';
import { encryptUsingSessionProtocol } from '../crypto/MessageEncrypter';

export interface GroupInfo {
  id: string;
  name: string;
  members: Array<string>; // Primary keys
  is_medium_group: boolean;
  active?: boolean;
  expireTimer?: number | null;
  avatar?: any;
  color?: any; // what is this???
  blocked?: boolean;
  admins?: Array<string>;
  secretKey?: Uint8Array;
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
  const groupIdentity = await Data.getIdentityKeyById(groupId);
  if (!groupIdentity) {
    throw new Error(`Could not load secret key for group ${groupId}`);
  }

  const secretKey = groupIdentity.secretKey;

  if (!secretKey) {
    throw new Error(
      `Secret key not found in identity key record for group ${groupId}`
    );
  }

  return new Uint8Array(fromHex(secretKey));
}

// Secondary devices are not expected to already have the group, so
// we send messages of type NEW
export async function syncMediumGroups(groups: Array<ConversationModel>) {
  // await Promise.all(groups.map(syncMediumGroup));
}

export async function initiateGroupUpdate(
  groupId: string,
  groupName: string,
  members: Array<string>,
  avatar: any
) {
  const convo = await ConversationController.getInstance().getOrCreateAndWait(
    groupId,
    'group'
  );

  if (convo.isPublic()) {
    await updateOpenGroup(convo, groupName, avatar);
    return;
  }
  const isMediumGroup = convo.isMediumGroup();

  if (!isMediumGroup) {
    throw new Error('Legacy group are not supported anymore.');
  }

  const groupDetails = {
    id: groupId,
    name: groupName,
    members,
    active: true,
    expireTimer: convo.get('expireTimer'),
    avatar,
    is_medium_group: true,
  };

  const diff = buildGroupDiff(convo, groupDetails);

  await updateOrCreateClosedGroupV2(groupDetails);

  if (avatar) {
    // would get to download this file on each client in the group
    // and reference the local file
  }

  const updateObj: GroupInfo = {
    id: groupId,
    name: groupName,
    members,
    is_medium_group: true,
    admins: convo.get('groupAdmins'),
    expireTimer: convo.get('expireTimer'),
  };

  const dbMessage = await addUpdateMessage(convo, diff, 'outgoing');
  window.getMessageController().register(dbMessage.id, dbMessage);

  await sendGroupUpdateForClosedV2(convo, diff, updateObj, dbMessage.id);
}

export async function addUpdateMessage(
  convo: ConversationModel,
  diff: GroupDiff,
  type: MessageModelType
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

  const markUnread = type === 'incoming';

  const message = await convo.addMessage({
    conversationId: convo.get('id'),
    type,
    sent_at: now,
    received_at: now,
    group_update: groupUpdate,
    unread: markUnread,
  });

  if (markUnread) {
    // update the unreadCount for this convo
    const unreadCount = await convo.getUnreadCount();
    convo.set({
      unreadCount,
    });
    await convo.commit();
  }

  return message;
}

export function buildGroupDiff(
  convo: ConversationModel,
  update: UpdatableGroupState
): GroupDiff {
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

export async function updateOrCreateClosedGroupV2(details: GroupInfo) {
  const { libloki } = window;

  const { id } = details;

  libloki.api.debug.logGroupSync(
    'Got sync group message  v2with group id',
    id,
    ' details:',
    details
  );

  const conversation = await ConversationController.getInstance().getOrCreateAndWait(
    id,
    'group'
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
    }
    updates.left = false;
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
  conversation.updateTextInputState();

  const { expireTimer } = details;

  if (expireTimer === undefined || typeof expireTimer !== 'number') {
    return;
  }
  const source = await UserUtil.getCurrentDevicePubKey();
  await conversation.updateExpirationTimer(expireTimer, source, Date.now(), {
    fromSync: true,
  });
}

export async function leaveClosedGroupV2(groupId: string) {
  window.SwarmPolling.removePubkey(groupId);

  const convo = ConversationController.getInstance().get(groupId);

  if (!convo) {
    window.log.error('Cannot leave non-existing v2 group');
    return;
  }
  const ourPrimary = await UserUtil.getPrimary();
  const isCurrentUserAdmin = convo.get('groupAdmins')?.includes(ourPrimary.key);

  const now = Date.now();
  let members: Array<string> = [];

  // for now, a destroyed group is one with those 2 flags set to true.
  // FIXME audric, add a flag to conversation model when a group is destroyed
  if (isCurrentUserAdmin) {
    window.log.info('Admin left a closed group v2. We need to destroy it');
    convo.set({ left: true, isKickedFromGroup: true });
    members = [];
  } else {
    convo.set({ left: true });
    members = convo.get('members').filter(m => m !== ourPrimary.key);
  }
  convo.set({ members });
  await convo.commit();

  const dbMessage = await convo.addMessage({
    group_update: { left: 'You' },
    conversationId: groupId,
    type: 'outgoing',
    sent_at: now,
    received_at: now,
  });
  window.getMessageController().register(dbMessage.id, dbMessage);

  const groupUpdate: GroupInfo = {
    id: convo.get('id'),
    name: convo.get('name'),
    members,
    is_medium_group: true,
    admins: convo.get('groupAdmins'),
  };

  await sendGroupUpdateForClosedV2(
    convo,
    { leavingMembers: [ourPrimary.key] },
    groupUpdate,
    dbMessage.id
  );
}

export async function sendGroupUpdateForClosedV2(
  convo: ConversationModel,
  diff: MemberChanges,
  groupUpdate: GroupInfo,
  messageId: string
) {
  const { id: groupId, members, name: groupName, expireTimer } = groupUpdate;
  const ourPrimary = await UserUtil.getPrimary();

  const removedMembers = diff.leavingMembers || [];
  const newMembers = diff.joiningMembers || []; // joining members
  const wasAnyUserRemoved = removedMembers.length > 0;
  const isUserLeaving = removedMembers.includes(ourPrimary.key);
  const isCurrentUserAdmin = convo.get('groupAdmins')?.includes(ourPrimary.key);
  const expireTimerToShare = expireTimer || 0;

  const admins = groupUpdate.admins || [];

  // Check preconditions
  const hexEncryptionKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(
    groupId
  );
  if (!hexEncryptionKeyPair) {
    throw new Error("Couldn't get key pair for closed group");
  }

  const encryptionKeyPair = ECKeyPair.fromHexKeyPair(hexEncryptionKeyPair);

  if (removedMembers.includes(admins[0]) && newMembers.length !== 0) {
    throw new Error(
      "Can't remove admin from closed group without removing everyone."
    ); // Error.invalidClosedGroupUpdate
  }

  if (isUserLeaving && newMembers.length !== 0) {
    if (removedMembers.length !== 1 || newMembers.length !== 0) {
      throw new Error(
        "Can't remove self and add or remove others simultaneously."
      );
    }
  }

  // Send the update to the group
  const mainClosedGroupUpdate = new ClosedGroupV2UpdateMessage({
    timestamp: Date.now(),
    groupId,
    name: groupName,
    members,
    identifier: messageId || uuid(),
    expireTimer: expireTimerToShare,
  });

  if (isUserLeaving) {
    window.log.info(
      `We are leaving the group ${groupId}. Sending our leaving message.`
    );
    // sent the message to the group and once done, remove everything related to this group
    window.SwarmPolling.removePubkey(groupId);
    await getMessageQueue().sendToGroup(mainClosedGroupUpdate, async () => {
      window.log.info(
        `Leaving message sent ${groupId}. Removing everything related to this group.`
      );
      await Data.removeAllClosedGroupEncryptionKeyPairs(groupId);
    });
  } else {
    // Send the group update, and only once sent, generate and distribute a new encryption key pair if needed
    await getMessageQueue().sendToGroup(mainClosedGroupUpdate, async () => {
      if (wasAnyUserRemoved && isCurrentUserAdmin) {
        // we send the new encryption key only to members already here before the update
        const membersNotNew = members.filter(m => !newMembers.includes(m));
        window.log.info(
          `Sending group update: A user was removed from ${groupId} and we are the admin. Generating and sending a new EncryptionKeyPair`
        );

        await generateAndSendNewEncryptionKeyPair(groupId, membersNotNew);
      }
    });

    if (newMembers.length) {
      // Send closed group update messages to any new members individually
      const newClosedGroupUpdate = new ClosedGroupV2NewMessage({
        timestamp: Date.now(),
        name: groupName,
        groupId,
        admins,
        members,
        keypair: encryptionKeyPair,
        identifier: messageId || uuid(),
        expireTimer: expireTimerToShare,
      });

      // if an expiretimer in this ClosedGroupV2 already, send it in another message
      // if an expire timer is set, we have to send it to the joining members
      let expirationTimerMessage: ExpirationTimerUpdateMessage | undefined;
      if (expireTimer && expireTimer > 0) {
        const expireUpdate = {
          timestamp: Date.now(),
          expireTimer,
          groupId: groupId,
        };

        expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);
      }
      const promises = newMembers.map(async m => {
        await ConversationController.getInstance().getOrCreateAndWait(
          m,
          'private'
        );
        const memberPubKey = PubKey.cast(m);
        await getMessageQueue().sendUsingMultiDevice(
          memberPubKey,
          newClosedGroupUpdate
        );

        if (expirationTimerMessage) {
          await getMessageQueue().sendUsingMultiDevice(
            memberPubKey,
            expirationTimerMessage
          );
        }
      });
      await Promise.all(promises);
    }
  }

  // Update the group
  // await SenderKeyAPI.updateOrCreateClosedGroupV2(groupDetails);
}

export async function generateAndSendNewEncryptionKeyPair(
  groupPublicKey: string,
  targetMembers: Array<string>
) {
  const groupConvo = ConversationController.getInstance().get(groupPublicKey);
  const groupId = fromHexToArray(groupPublicKey);

  if (!groupConvo) {
    window.log.warn(
      'generateAndSendNewEncryptionKeyPair: conversation not found',
      groupPublicKey
    );
    return;
  }
  if (!groupConvo.isMediumGroup()) {
    window.log.warn(
      'generateAndSendNewEncryptionKeyPair: conversation not a closed group v2',
      groupPublicKey
    );
    return;
  }

  const ourPrimary = await UserUtil.getPrimary();
  if (!groupConvo.get('groupAdmins')?.includes(ourPrimary.key)) {
    window.log.warn(
      'generateAndSendNewEncryptionKeyPair: cannot send it as a non admin'
    );
    return;
  }

  // Generate the new encryption key pair
  const newKeyPair = await generateCurve25519KeyPairWithoutPrefix();

  if (!newKeyPair) {
    window.log.warn(
      'generateAndSendNewEncryptionKeyPair: failed to generate new keypair'
    );
    return;
  }
  const proto = new SignalService.ClosedGroupUpdateV2.KeyPair({
    privateKey: newKeyPair?.privateKeyData,
    publicKey: newKeyPair?.publicKeyData,
  });
  const plaintext = SignalService.ClosedGroupUpdateV2.KeyPair.encode(
    proto
  ).finish();

  // Distribute it
  const wrappers = await Promise.all(
    targetMembers.map(async pubkey => {
      const ciphertext = await encryptUsingSessionProtocol(
        PubKey.cast(pubkey),
        plaintext
      );
      return new SignalService.ClosedGroupUpdateV2.KeyPairWrapper({
        encryptedKeyPair: ciphertext,
        publicKey: fromHexToArray(pubkey),
      });
    })
  );

  const expireTimerToShare = groupConvo.get('expireTimer') || 0;

  const keypairsMessage = new ClosedGroupV2EncryptionPairMessage({
    groupId: toHex(groupId),
    timestamp: Date.now(),
    encryptedKeyPairs: wrappers,
    expireTimer: expireTimerToShare,
  });

  const messageSentCallback = async () => {
    window.log.info(
      `KeyPairMessage for ClosedGroupV2 ${groupPublicKey} is sent. Saving the new encryptionKeyPair.`
    );

    // tslint:disable-next-line: no-non-null-assertion
    await Data.addClosedGroupEncryptionKeyPair(
      toHex(groupId),
      newKeyPair.toHexKeyPair()
    );
  };

  await getMessageQueue().sendToGroup(keypairsMessage, messageSentCallback);
}
