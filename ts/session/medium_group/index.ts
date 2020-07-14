import { PubKey } from '../types';
import { onGroupReceived } from '../../receiver/receiver';
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

export {
  createSenderKeyForGroup,
  saveSenderKeys,
  saveSenderKeysInner,
  getChainKey,
};

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

export async function createMediumSizeGroup(
  groupName: string,
  members: Array<string>
) {
  const { ConversationController, libsignal } = window;

  // Create Group Identity
  const identityKeys = await libsignal.KeyHelper.generateIdentityKeyPair();
  const groupId = StringUtils.decode(identityKeys.pubKey, 'hex');

  const groupSecretKeyHex = StringUtils.decode(identityKeys.privKey, 'hex');

  const primary = window.storage.get('primaryDevicePubKey');

  const allMembers = [primary, ...members];

  const senderKeys = await createSenderKeysForMembers(groupId, allMembers);

  // TODO: make this strongly typed!
  await Data.createOrUpdateIdentityKey({
    id: groupId,
    secretKey: groupSecretKeyHex,
  });

  const groupDetails = {
    id: groupId,
    name: groupName,
    members: allMembers,
    recipients: allMembers,
    active: true,
    expireTimer: 0,
    avatar: '',
    secretKey: new Uint8Array(identityKeys.privKey),
    senderKeys,
    is_medium_group: true,
  };

  await onGroupReceived(groupDetails);

  const convo = await ConversationController.getOrCreateAndWait(
    groupId,
    'group'
  );

  convo.updateGroupAdmins([primary]);

  convo.updateGroup(groupDetails);

  window.owsDesktopApp.appView.openConversation(groupId, {});

  // Subscribe to this group id
  window.SwarmPolling.addGroupId(new PubKey(groupId));
}
