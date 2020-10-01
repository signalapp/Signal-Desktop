import { PubKey } from '../types';
import { StringUtils } from '../utils';
import * as Data from '../../../js/modules/data';
import _ from 'lodash';

import {
  createSenderKeyForGroup,
  RatchetState,
  saveSenderKeys,
  saveSenderKeysInner,
} from './senderKeys';
import { getChainKey } from './ratchet';
import { MultiDeviceProtocol } from '../protocols';
import { BufferType } from '../utils/String';
import { UserUtil } from '../../util';
import {
  ClosedGroupChatMessage,
  ClosedGroupMessage,
  ClosedGroupUpdateMessage,
  ExpirationTimerUpdateMessage,
  MediumGroupCreateMessage,
  MediumGroupMessage,
  Message,
} from '../messages/outgoing';
import { MessageModel, MessageModelType } from '../../../js/models/messages';
import { getMessageQueue } from '../../session';
import { ConversationModel } from '../../../js/models/conversations';
import { MediumGroupUpdateMessage } from '../messages/outgoing/content/data/mediumgroup/MediumGroupUpdateMessage';
import uuid from 'uuid';
import { BlockedNumberController } from '../../util/blockedNumberController';
import { shareSenderKeys } from '../../receiver/mediumGroups';

export {
  createSenderKeyForGroup,
  saveSenderKeys,
  saveSenderKeysInner,
  getChainKey,
};

const toHex = (d: BufferType) => StringUtils.decode(d, 'hex');
const fromHex = (d: string) => StringUtils.encode(d, 'hex');

async function createSenderKeysForMembers(
  groupId: string,
  members: Array<string>
): Promise<Array<RatchetState>> {
  const allDevices = await Promise.all(
    members.map(async pk => {
      return MultiDeviceProtocol.getAllDevices(pk);
    })
  );

  const devicesFlat = _.flatten(allDevices);

  return Promise.all(
    devicesFlat.map(async pk => {
      return createSenderKeyForGroup(groupId, PubKey.cast(pk));
    })
  );
}

export async function createMediumGroup(
  groupName: string,
  members: Array<string>
) {
  const { ConversationController, libsignal } = window;

  // ***** 1. Create group parameters *****

  // Create Group Identity
  const identityKeys = await libsignal.KeyHelper.generateIdentityKeyPair();
  const groupId = toHex(identityKeys.pubKey);

  const groupSecretKeyHex = toHex(identityKeys.privKey);

  // TODO: make this strongly typed!
  await Data.createOrUpdateIdentityKey({
    id: groupId,
    secretKey: groupSecretKeyHex,
  });

  const primary: string = window.storage.get('primaryDevicePubKey');

  const allMembers = [primary, ...members];

  const newKeys = await createSenderKeysForMembers(groupId, allMembers);

  const senderKeysContainer: SenderKeysContainer = {
    newKeys,
    existingKeys: [],
  };

  // ***** 2. Send group update message *****

  const convo = await ConversationController.getOrCreateAndWait(
    groupId,
    'group'
  );

  const admins = [primary];

  const groupDetails = {
    id: groupId,
    name: groupName,
    members: allMembers,
    admins,
    active: true,
    expireTimer: 0,
    secretKey: new Uint8Array(identityKeys.privKey),
    senderKeysContainer,
    is_medium_group: true,
  };

  const groupDiff: GroupDiff = {
    newName: groupName,
    joiningMembers: allMembers,
  };

  const dbMessage = await addUpdateMessage(convo, groupDiff, 'outgoing');

  await sendGroupUpdate(convo, groupDiff, groupDetails, dbMessage.id);

  // ***** 3. Add update message to the conversation *****

  await updateOrCreateGroup(groupDetails);

  convo.updateGroupAdmins(admins);

  window.owsDesktopApp.appView.openConversation(groupId, {});

  // Subscribe to this group id
  window.SwarmPolling.addGroupId(new PubKey(groupId));
}

// Legacy groups don't belong here, but we will probably remove them anyway
export async function createLegacyGroup(
  groupName: string,
  members: Array<string>
) {
  const { ConversationController, libsignal } = window;

  const keypair = await libsignal.KeyHelper.generateIdentityKeyPair();
  const groupId = toHex(keypair.pubKey);

  const primary = await UserUtil.getPrimary();

  const allMembers = [primary.key, ...members];

  const groupDetails = {
    id: groupId,
    name: groupName,
    members: allMembers,
    active: true,
    expireTimer: 0,
    is_medium_group: false,
    admins: [primary.key],
  };

  await updateOrCreateGroup(groupDetails);

  const convo = await ConversationController.getOrCreateAndWait(
    groupId,
    'group'
  );

  convo.updateGroupAdmins([primary.key]);

  const diff: GroupDiff = {
    newName: groupName,
    joiningMembers: allMembers,
  };

  const dbMessage = await addUpdateMessage(convo, diff, 'outgoing');

  await sendGroupUpdate(convo, diff, groupDetails, dbMessage.id);

  window.textsecure.messaging.sendGroupSyncMessage([convo]);
  window.owsDesktopApp.appView.openConversation(groupId, {});
}

export async function leaveMediumGroup(groupId: string) {
  const { ConversationController } = window;
  // NOTE: we should probably remove sender keys for groupId,
  // and its secret key, but it is low priority

  // TODO: need to reset everyone's sender keys
  window.SwarmPolling.removePubkey(groupId);
  // TODO audric: we just left a group, we have to regenerate our senderkey

  const maybeConvo = await ConversationController.get(groupId);

  if (!maybeConvo) {
    window.log.error('Cannot leave non-existing group');
    return;
  }

  const convo: ConversationModel = maybeConvo;

  const now = Date.now();

  convo.set({ left: true });
  await convo.commit();

  const dbMessage = await convo.addMessage({
    group_update: { left: 'You' },
    conversationId: groupId,
    type: 'outgoing',
    sent_at: now,
    received_at: now,
  });
  const ourPrimary = await UserUtil.getPrimary();

  const members = convo.get('members').filter(m => m !== ourPrimary.key);
  // do not include senderkey as everyone needs to generate new one
  const groupUpdate: GroupInfo = {
    id: convo.get('id'),
    name: convo.get('name'),
    members,
    is_medium_group: true,
    admins: convo.get('groupAdmins'),
  };

  await sendGroupUpdateForMedium(
    { leavingMembers: [ourPrimary.key] },
    groupUpdate,
    dbMessage.id
  );
}

// Just a container to store two named list of keys
interface SenderKeysContainer {
  newKeys: Array<RatchetState>;
  existingKeys: Array<RatchetState>;
}

// Load all known keys for all members (or only for select devices if specified)
async function getExistingSenderKeysForGroup(
  groupId: string,
  devices: Array<PubKey>
): Promise<Array<RatchetState>> {
  const maybeKeys = await Promise.all(
    devices.map(async device => {
      const maybeKey = await getChainKey(groupId, device.key);

      if (!maybeKey) {
        return null;
      } else {
        const { chainKey, keyIdx } = maybeKey;
        const pubKeyBin = new Uint8Array(fromHex(device.key));
        return {
          chainKey: new Uint8Array(chainKey),
          keyIdx,
          pubKey: pubKeyBin,
        };
      }
    })
  );

  return maybeKeys.filter(d => d !== null).map(d => d as RatchetState);
}

// Get a list of senderKeys we have to send to joining members
// Basically this is the senderkey of all members who joined concatenated with
// the one of members currently in the group.

// Also, the list of senderkeys for existing member must be empty if there is any leaving members,
// as they each member need to regenerate a new senderkey
async function getOrUpdateSenderKeysForJoiningMembers(
  groupId: string,
  members: Array<string>,
  diff?: GroupDiff,
  joiningMembersSenderKeys?: Array<RatchetState>
): Promise<Array<RatchetState>> {
  const leavingMembers = diff?.leavingMembers || [];
  const joiningMembers = diff?.joiningMembers || [];

  const existingMembers = _.difference(members, joiningMembers);
  // get all devices for members
  const allDevices = _.flatten(
    await Promise.all(
      existingMembers.map(m => MultiDeviceProtocol.getAllDevices(m))
    )
  );

  let existingKeys: Array<RatchetState> = [];
  if (leavingMembers.length === 0) {
    existingKeys = await getExistingSenderKeysForGroup(groupId, allDevices);
  }
  return _.union(joiningMembersSenderKeys, existingKeys);
}

async function getGroupSecretKey(groupId: string): Promise<Uint8Array> {
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

async function syncMediumGroup(group: ConversationModel) {
  throw new Error(
    'Medium group syncing must be done once multi device is enabled back'
  );
  const ourPrimary = await UserUtil.getPrimary();

  const groupId = group.get('id');
  const members = group.get('members');

  const secretKey = await getGroupSecretKey(groupId);

  const allDevices = _.flatten(
    await Promise.all(members.map(m => MultiDeviceProtocol.getAllDevices(m)))
  );

  const secondaryKeys = await MultiDeviceProtocol.getSecondaryDevices(
    ourPrimary
  );

  const existingKeys = await getExistingSenderKeysForGroup(groupId, allDevices);
  const senderKeysForSecondary = await Promise.all(
    secondaryKeys.map(key => createSenderKeyForGroup(groupId, key))
  );
  const senderKeysContainer: SenderKeysContainer = {
    existingKeys,
    newKeys: senderKeysForSecondary,
  };

  const groupUpdate: GroupInfo = {
    id: group.get('id'),
    name: group.get('name'),
    members: group.get('members'),
    is_medium_group: true,
    admins: group.get('groupAdmins'),
    secretKey,
  };

  // Note: we send this to our primary device which will in effect will send to
  // our other devices, actually ignoring the current device
  await sendGroupUpdateForMedium(
    { joiningMembers: [ourPrimary.key] },
    groupUpdate
  );
}

// Secondary devices are not expected to already have the group, so
// we send messages of type NEW
export async function syncMediumGroups(groups: Array<ConversationModel>) {
  await Promise.all(groups.map(syncMediumGroup));
}

export async function initiateGroupUpdate(
  groupId: string,
  groupName: string,
  members: Array<string>,
  avatar: any
) {
  const { ConversationController } = window;

  const convo = await ConversationController.getOrCreateAndWait(
    groupId,
    'group'
  );

  const isMediumGroup = convo.isMediumGroup();

  const groupDetails = {
    id: groupId,
    name: groupName,
    members,
    active: true,
    expireTimer: convo.get('expireTimer'),
    avatar,
    is_medium_group: isMediumGroup,
  };

  const diff = calculateGroupDiff(convo, groupDetails);

  await updateOrCreateGroup(groupDetails);

  if (convo.isPublic()) {
    await updatePublicGroup(convo, groupName, avatar);
    return;
  }

  if (avatar) {
    // would get to download this file on each client in the group
    // and reference the local file
  }

  const updateObj: GroupInfo = {
    id: groupId,
    name: groupName,
    members,
    is_medium_group: isMediumGroup,
    admins: convo.get('groupAdmins'),
  };

  if (isMediumGroup) {
    // Send group secret key
    const secretKey = await getGroupSecretKey(groupId);

    updateObj.secretKey = secretKey;
  }

  const dbMessage = await addUpdateMessage(convo, diff, 'outgoing');

  await sendGroupUpdate(convo, diff, updateObj, dbMessage.id);
}

// NOTE: Old-style groups and open groups don't really belong here
async function updatePublicGroup(convo: any, groupName: string, avatar: any) {
  const API = await convo.getPublicSendData();

  if (avatar) {
    // I hate duplicating this...
    const readFile = async (attachment: any) =>
      new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = (e: any) => {
          const data = e.target.result;
          resolve({
            ...attachment,
            data,
            size: data.byteLength,
          });
        };
        fileReader.onerror = reject;
        fileReader.onabort = reject;
        fileReader.readAsArrayBuffer(attachment.file);
      });
    const avatarAttachment: any = await readFile({ file: avatar });
    // const tempUrl = window.URL.createObjectURL(avatar);

    // Get file onto public chat server
    const fileObj = await API.serverAPI.putAttachment(avatarAttachment.data);
    if (fileObj === null) {
      // problem
      window.log.warn('File upload failed');
      return;
    }

    // lets not allow ANY URLs, lets force it to be local to public chat server
    const url = new URL(fileObj.url);

    // write it to the channel
    await API.setChannelAvatar(url.pathname);
  }

  if (await API.setChannelName(groupName)) {
    // queue update from server
    // and let that set the conversation
    API.pollForChannelOnce();
    // or we could just directly call
    // convo.setGroupName(groupName);
    // but gut is saying let the server be the definitive storage of the state
    // and trickle down from there
  }
}

async function sendToMembers(
  groupId: string,
  message: MediumGroupMessage,
  dbMessage: MessageModel
) {
  const { ConversationController } = window;
  const convo = await ConversationController.getOrCreateAndWait(
    groupId,
    'group'
  );

  const members = convo.get('members') || [];

  try {
    // Exclude our device from members and send them the message
    const primary = await UserUtil.getPrimary();

    const otherMembers = members.filter(
      (member: string) => !primary.isEqual(member)
    );
    // we are the only member in here
    if (members.length === 1 && members[0] === primary.key) {
      dbMessage.sendSyncMessageOnly(message);
      return;
    }
    const sendPromises = otherMembers.map(async (member: string) => {
      const memberPubKey = PubKey.cast(member);
      return getMessageQueue().sendUsingMultiDevice(memberPubKey, message);
    });
    await Promise.all(sendPromises);
  } catch (e) {
    window.log.error(e);
  }
}

interface GroupInfo {
  id: string;
  name: string;
  members: Array<string>; // Primary keys
  is_medium_group: boolean;
  active?: boolean;
  expireTimer?: number;
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

  const message = await convo.addMessage({
    conversationId: convo.get('id'),
    type,
    sent_at: now,
    received_at: now,
    group_update: groupUpdate,
  });

  return message;
}

export function calculateGroupDiff(
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

async function sendGroupUpdateForMedium(
  diff: MemberChanges,
  groupUpdate: GroupInfo,
  messageId?: string
) {
  const { id: groupId, members, name: groupName } = groupUpdate;
  const ourPrimary = await UserUtil.getPrimary();

  const leavingMembers = diff.leavingMembers || [];
  const joiningMembers = diff.joiningMembers || [];
  const wasAnyUserRemoved = leavingMembers.length > 0;
  const isUserLeaving = leavingMembers.includes(ourPrimary.key);

  const membersBin = members.map(
    (pkHex: string) => new Uint8Array(fromHex(pkHex))
  );

  const admins = groupUpdate.admins || [];
  const adminsBin = admins.map(
    (pkHex: string) => new Uint8Array(fromHex(pkHex))
  );

  const remainingMembers = _.difference(groupUpdate.members, joiningMembers);

  const params = {
    timestamp: Date.now(),
    identifier: messageId || uuid(),
    groupId,
    members: membersBin,
    groupName,
    admins: adminsBin,
  };

  if (wasAnyUserRemoved) {
    if (isUserLeaving && leavingMembers.length !== 1) {
      window.log.warn("Can't remove self and others simultaneously.");
      return;
    }
    // Send the update to the group (don't include new ratchets as everyone should regenerate new ratchets individually)
    const paramsWithoutSenderKeys = {
      ...params,
      senderKeys: [],
    };

    const messageStripped = new MediumGroupUpdateMessage(
      paramsWithoutSenderKeys
    );
    window.log.warn('Sending to groupUpdateMessage without senderKeys');
    await getMessageQueue().sendToGroup(messageStripped);

    getMessageQueue().events.addListener('success', async message => {
      if (message.identifier === params.identifier) {
        // console.log('Our first message encrypted with old sk is sent.');
        // TODO Delete all ratchets (it's important that this happens * after * sending out the update)
        if (isUserLeaving) {
          // nothing to do on desktop
        } else {
          // Send out the user's new ratchet to all members (minus the removed ones) using established channels
          const userSenderKey = await createSenderKeyForGroup(
            groupId,
            ourPrimary
          );
          window.log.warn(
            'Sharing our new senderKey with remainingMembers via message',
            remainingMembers,
            userSenderKey
          );

          await shareSenderKeys(groupId, remainingMembers, userSenderKey);
        }
      }
    });
  } else {
    let senderKeys: Array<RatchetState>;
    if (joiningMembers.length > 0) {
      // Generate ratchets for any new members
      senderKeys = await createSenderKeysForMembers(groupId, joiningMembers);
    } else {
      // It's not a member change, maybe an name change. So just reuse all senderkeys
      senderKeys = await getOrUpdateSenderKeysForJoiningMembers(
        groupId,
        members
      );
    }
    const paramsWithSenderKeys = {
      ...params,
      senderKeys,
    };
    // Send a closed group update message to the existing members with the new members' ratchets (this message is aimed at the group)
    const message = new MediumGroupUpdateMessage(paramsWithSenderKeys);
    window.log.warn(
      'Sending to groupUpdateMessage with joining members senderKeys to groupAddress',
      senderKeys
    );

    await getMessageQueue().sendToGroup(message);

    // now send a CREATE group message with all senderkeys no matter what to all joining members, using established channels
    if (joiningMembers.length) {
      const { secretKey } = groupUpdate;

      if (!secretKey) {
        window.log.error('Group secret key not specified, aborting...');
        return;
      }
      const allSenderKeys = await getOrUpdateSenderKeysForJoiningMembers(
        groupId,
        members
      );

      const createParams = {
        timestamp: Date.now(),
        identifier: messageId || uuid(),
        groupSecretKey: secretKey,
        groupId,
        members: membersBin,
        groupName,
        admins: adminsBin,
        senderKeys: allSenderKeys,
      };

      const mediumGroupCreateMessage = new MediumGroupCreateMessage(
        createParams
      );
      // console.warn(
      //   'sending group create to',
      //   joiningMembers,
      //   ' obj: ',
      //   mediumGroupCreateMessage
      // );

      joiningMembers.forEach(async member => {
        const memberPubKey = new PubKey(member);
        await getMessageQueue().sendUsingMultiDevice(
          memberPubKey,
          mediumGroupCreateMessage
        );
      });
    }
  }
}

async function sendGroupUpdateForLegacy(
  convo: ConversationModel,
  diff: MemberChanges,
  groupUpdate: GroupInfo,
  messageId: string
) {
  const { id: groupId, name, members, avatar } = groupUpdate;

  const now = Date.now();

  const updateParams = {
    // if we do set an identifier here, be sure to not sync the message two times in msg.handleMessageSentSuccess()
    identifier: messageId,
    timestamp: now,
    groupId,
    name,
    avatar,
    members,
    admins: convo.get('groupAdmins'),
  };
  const groupUpdateMessage = new ClosedGroupUpdateMessage(updateParams);

  const recipients = _.union(diff.leavingMembers, groupUpdate.members);

  await sendClosedGroupMessage(groupUpdateMessage, recipients);

  // Send current timer update to every joining member
  if (
    diff.joiningMembers &&
    diff.joiningMembers.length &&
    convo.get('expireTimer')
  ) {
    const expireUpdate = {
      timestamp: Date.now(),
      expireTimer: convo.get('expireTimer'),
      groupId,
    };

    const expirationTimerMessage = new ExpirationTimerUpdateMessage(
      expireUpdate
    );
    await Promise.all(
      diff.joiningMembers.map(async member => {
        const device = new PubKey(member);
        await getMessageQueue()
          .sendUsingMultiDevice(device, expirationTimerMessage)
          .catch(window.log.error);
      })
    );
  }
}

async function sendGroupUpdate(
  convo: ConversationModel,
  diff: MemberChanges,
  groupUpdate: GroupInfo,
  messageId: string
) {
  if (groupUpdate.is_medium_group) {
    await sendGroupUpdateForMedium(diff, groupUpdate, messageId);
  } else {
    await sendGroupUpdateForLegacy(convo, diff, groupUpdate, messageId);
  }
}

export async function updateOrCreateGroupFromSync(details: GroupInfo) {
  await updateOrCreateGroup(details);
}

// update conversation model
async function updateOrCreateGroup(details: GroupInfo) {
  const { ConversationController, libloki, storage, textsecure } = window;

  const { id } = details;

  libloki.api.debug.logGroupSync(
    'Got sync group message with group id',
    id,
    ' details:',
    details
  );

  const conversation = await ConversationController.getOrCreateAndWait(
    id,
    'group'
  );

  // TODO: check that we don't downgrade an existing group to a 'medium group'

  const updates: any = {
    name: details.name,
    members: details.members,
    color: details.color,
    type: 'group',
    is_medium_group: details.is_medium_group || false,
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
  if (conversation.isClosedGroup()) {
    await BlockedNumberController.setGroupBlocked(conversation.id, isBlocked);
  }

  conversation.trigger('change', conversation);
  conversation.updateTextInputState();

  await conversation.commit();

  const { expireTimer } = details;
  const isValidExpireTimer = typeof expireTimer === 'number';
  if (!isValidExpireTimer) {
    return;
  }

  const source = textsecure.storage.user.getNumber();
  const receivedAt = Date.now();
  await conversation.updateExpirationTimer(expireTimer, source, receivedAt, {
    fromSync: true,
  });
}

export async function sendClosedGroupMessage(
  message: ClosedGroupMessage,
  recipients: Array<string>
) {
  // Sync messages for Chat Messages need to be constructed after confirming send was successful.
  if (message instanceof ClosedGroupChatMessage) {
    throw new Error(
      'ClosedGroupChatMessage should be constructed manually and sent'
    );
  }

  try {
    // Exclude our device from members and send them the message
    const primary = await UserUtil.getPrimary();
    const otherMembers = (recipients || []).filter(
      member => !primary.isEqual(member)
    );
    // NOTE(maxim): this is an edge case that we won't need
    // to handle once we've reworked how the queue works

    // we are the only member in here
    // if (recipients.length === 1 && recipients[0] === primary.key) {
    //   dbMessage.sendSyncMessageOnly(message);
    //   return;
    // }
    const sendPromises = otherMembers.map(async member => {
      const memberPubKey = PubKey.cast(member);
      return getMessageQueue().sendUsingMultiDevice(memberPubKey, message);
    });
    await Promise.all(sendPromises);
  } catch (e) {
    window.log.error(e);
  }
}
