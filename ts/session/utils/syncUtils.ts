import {
  createOrUpdateItem,
  getItemById,
  getLatestClosedGroupEncryptionKeyPair,
  Snode,
} from '../../../ts/data/data';
import { getMessageQueue, Utils } from '..';
import { getConversationController } from '../conversations';
import uuid from 'uuid';
import { StringUtils, UserUtils } from '.';
import { ECKeyPair } from '../../receiver/keypairs';
import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
  ConfigurationMessageContact,
} from '../messages/outgoing/controlMessage/ConfigurationMessage';
import { ConversationModel } from '../../models/conversation';
import { fromBase64ToArray, fromHexToArray, fromUInt8ArrayToBase64, toHex } from './String';
import { SignalService } from '../../protobuf';
import _ from 'lodash';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { ExpirationTimerUpdateMessage } from '../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { getV2OpenGroupRoom } from '../../data/opengroups';
import { getCompleteUrlFromRoom } from '../../opengroup/utils/OpenGroupUtils';
import { DURATION } from '../constants';
import { SnodePool } from '../snode_api';
import { snodeHttpsAgent } from '../snode_api/onions';

import { default as insecureNodeFetch } from 'node-fetch';
import { getSodium } from '../crypto';
import { encryptUsingSessionProtocol } from '../crypto/MessageEncrypter';
import { snodeRpc } from '../snode_api/lokiRpc';

const ITEM_ID_LAST_SYNC_TIMESTAMP = 'lastSyncedTimestamp';

const getLastSyncTimestampFromDb = async (): Promise<number | undefined> =>
  (await getItemById(ITEM_ID_LAST_SYNC_TIMESTAMP))?.value;

const writeLastSyncTimestampToDb = async (timestamp: number) =>
  createOrUpdateItem({ id: ITEM_ID_LAST_SYNC_TIMESTAMP, value: timestamp });

export const syncConfigurationIfNeeded = async () => {
  const lastSyncedTimestamp = (await getLastSyncTimestampFromDb()) || 0;
  const now = Date.now();

  // if the last sync was less than 2 days before, return early.
  if (Math.abs(now - lastSyncedTimestamp) < DURATION.DAYS * 7) {
    return;
  }

  const allConvos = getConversationController().getConversations();
  const configMessage = await getCurrentConfigurationMessage(allConvos);
  try {
    // window?.log?.info('syncConfigurationIfNeeded with', configMessage);

    await getMessageQueue().sendSyncMessage(configMessage);
  } catch (e) {
    window?.log?.warn('Caught an error while sending our ConfigurationMessage:', e);
    // we do return early so that next time we use the old timestamp again
    // and so try again to trigger a sync
    return;
  }
  await writeLastSyncTimestampToDb(now);
};

export const forceSyncConfigurationNowIfNeeded = async (waitForMessageSent = false) =>
  new Promise(resolve => {
    const allConvos = getConversationController().getConversations();

    // if we hang for more than 10sec, force resolve this promise.
    setTimeout(() => {
      resolve(false);
    }, 10000);

    void getCurrentConfigurationMessage(allConvos)
      .then(configMessage => {
        // this just adds the message to the sending queue.
        // if waitForMessageSent is set, we need to effectively wait until then
        // tslint:disable-next-line: no-void-expression
        const callback = waitForMessageSent
          ? () => {
            resolve(true);
          }
          : undefined;
        debugger;
        void getMessageQueue().sendSyncMessage(configMessage, callback as any);
        // either we resolve from the callback if we need to wait for it,
        // or we don't want to wait, we resolve it here.
        if (!waitForMessageSent) {
          resolve(true);
        }
      })
      .catch(e => {
        window?.log?.warn('Caught an error while building our ConfigurationMessage:', e);
        resolve(false);
      });
  });


/**
 * Makes a post to a node to receive the timestamp info. If non-existant, returns -1
 * @param snode Snode to send request to
 * @returns timestamp of the response from snode
 */
export const getNetworkTime = async (snode: Snode): Promise<string | number> => {
  // let response: any = await insecureNodeFetch(url, fetchOptions)
  try {

    let response: any = await snodeRpc('info', {}, snode);
    let body = JSON.parse(response.body);
    let timestamp = body['timestamp'];

    debugger;
    return timestamp ? timestamp : -1;
  }
  catch (e) {
    debugger;
    return -1;
  }

}

export const forceNetworkDeletion = async () => {

  // get keypair
  let userPubKey = await UserUtils.getOurPubKeyFromCache();

  // get ed255 key
  let userED25519Keypair = await UserUtils.getUserED25519KeyPair();
  if (userED25519Keypair === undefined || userED25519Keypair.privKey === undefined) {
    return;
  }

  // get random snode
  let snode: Snode | undefined = await SnodePool.getRandomSnode();

  let timestamp = await getNetworkTime(snode);

  let sodium = await getSodium();

  // create data by combining shit. Combines the method + timestamp to a byteArray in android
  let verificationData = 'delete_all' + timestamp.toString();

  // convert vert data to byteArray for signing

  // sign the data with sodium + user ed255key in byte for (userED25519Keypair.bytes)
  let userED25519SecretBytes = fromHexToArray(userED25519Keypair.privKey)

  let signature = sodium.crypto_sign_detached(verificationData, userED25519SecretBytes)

  // package into some params
  let deleteMessageParams = {
    pubkey: userPubKey.key, // not cast as anything in android example
    pubkeyED25519: toHex(StringUtils.encode(userED25519Keypair.pubKey, 'base64')) , // not sure if this is a proper hex value?
    // pubkeyED25519: userED25519Keypair.pubKey,
    timestamp, // -1 atm..
    signature: fromUInt8ArrayToBase64(signature)
  }

  // send method to the network.
  // await send('delete_all', snode, userPubKey.key, deleteMessageParams)

  let res = await snodeRpc('delete_all', deleteMessageParams, snode, userPubKey.key);
  debugger;
}

const send = async (method: string, snode: Snode, publicKey?: string, parameters?: any) => {
  let url = `https://${snode.ip}:${snode.port}/storage_rpc/v1`;

  let payload = {
    method,
    ...parameters
  }

  let fetchOptions = {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      //   // 'User-Agent': 'WhatsApp',
      // 'Accept-Language': 'en-us',
    },
    // timeout: 10000,
    agent: snodeHttpsAgent
  }

  let response: any = await insecureNodeFetch(url, fetchOptions)
  console.log({ response });
}

const getActiveOpenGroupV2CompleteUrls = async (
  convos: Array<ConversationModel>
): Promise<Array<string>> => {
  // Filter open groups v2
  const openGroupsV2ConvoIds = convos
    .filter(c => !!c.get('active_at') && c.isOpenGroupV2() && !c.get('left'))
    .map(c => c.id) as Array<string>;

  const urls = await Promise.all(
    openGroupsV2ConvoIds.map(async opengroup => {
      const roomInfos = await getV2OpenGroupRoom(opengroup);
      if (roomInfos) {
        return getCompleteUrlFromRoom(roomInfos);
      }
      return null;
    })
  );

  return _.compact(urls) || [];
};

const getValidClosedGroups = async (convos: Array<ConversationModel>) => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();

  // Filter Closed/Medium groups
  const closedGroupModels = convos.filter(
    c =>
      !!c.get('active_at') &&
      c.isMediumGroup() &&
      c.get('members').includes(ourPubKey) &&
      !c.get('left') &&
      !c.get('isKickedFromGroup') &&
      !c.isBlocked() &&
      c.get('name')
  );

  const closedGroups = await Promise.all(
    closedGroupModels.map(async c => {
      const groupPubKey = c.get('id');
      const fetchEncryptionKeyPair = await getLatestClosedGroupEncryptionKeyPair(groupPubKey);
      if (!fetchEncryptionKeyPair) {
        return null;
      }

      return new ConfigurationMessageClosedGroup({
        publicKey: groupPubKey,
        name: c.get('name') || '',
        members: c.get('members') || [],
        admins: c.get('groupAdmins') || [],
        encryptionKeyPair: ECKeyPair.fromHexKeyPair(fetchEncryptionKeyPair),
      });
    })
  );

  const onlyValidClosedGroup = closedGroups.filter(m => m !== null) as Array<
    ConfigurationMessageClosedGroup
  >;
  return onlyValidClosedGroup;
};

const getValidContacts = (convos: Array<ConversationModel>) => {
  // Filter contacts
  const contactsModels = convos.filter(
    c => !!c.get('active_at') && c.getLokiProfile()?.displayName && c.isPrivate() && !c.isBlocked()
  );

  const contacts = contactsModels.map(c => {
    try {
      const profileKeyForContact = c.get('profileKey')
        ? fromBase64ToArray(c.get('profileKey') as string)
        : undefined;

      return new ConfigurationMessageContact({
        publicKey: c.id,
        displayName: c.getLokiProfile()?.displayName,
        profilePictureURL: c.get('avatarPointer'),
        profileKey: profileKeyForContact,
      });
    } catch (e) {
      window?.log.warn('getValidContacts', e);
      return null;
    }
  });
  return _.compact(contacts);
};

export const getCurrentConfigurationMessage = async (convos: Array<ConversationModel>) => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = convos.find(convo => convo.id === ourPubKey);

  const opengroupV2CompleteUrls = await getActiveOpenGroupV2CompleteUrls(convos);
  const onlyValidClosedGroup = await getValidClosedGroups(convos);
  const validContacts = getValidContacts(convos);

  if (!ourConvo) {
    window?.log?.error('Could not find our convo while building a configuration message.');
  }
  const profileKeyFromStorage = window.storage.get('profileKey');
  const profileKey = profileKeyFromStorage ? new Uint8Array(profileKeyFromStorage) : undefined;

  const profilePicture = ourConvo?.get('avatarPointer') || undefined;
  const displayName = ourConvo?.getLokiProfile()?.displayName || undefined;

  const activeOpenGroups = [...opengroupV2CompleteUrls];

  return new ConfigurationMessage({
    identifier: uuid(),
    timestamp: Date.now(),
    activeOpenGroups,
    activeClosedGroups: onlyValidClosedGroup,
    displayName,
    profilePicture,
    profileKey,
    contacts: validContacts,
  });
};

const buildSyncVisibleMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  timestamp: number,
  syncTarget: string
) => {
  const body = dataMessage.body || undefined;

  const wrapToUInt8Array = (buffer: any) => {
    if (!buffer) {
      return undefined;
    }
    if (buffer instanceof Uint8Array) {
      // Audio messages are already uint8Array
      return buffer;
    }
    return new Uint8Array(buffer.toArrayBuffer());
  };
  const attachments = (dataMessage.attachments || []).map(attachment => {
    const key = wrapToUInt8Array(attachment.key);
    const digest = wrapToUInt8Array(attachment.digest);

    return {
      ...attachment,
      key,
      digest,
    };
  }) as Array<AttachmentPointerWithUrl>;
  const quote = (dataMessage.quote as Quote) || undefined;
  const preview = (dataMessage.preview as Array<PreviewWithAttachmentUrl>) || [];
  const expireTimer = dataMessage.expireTimer;

  return new VisibleMessage({
    identifier,
    timestamp,
    attachments,
    body,
    quote,
    preview,
    syncTarget,
    expireTimer,
  });
};

const buildSyncExpireTimerMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  timestamp: number,
  syncTarget: string
) => {
  const expireTimer = dataMessage.expireTimer;

  return new ExpirationTimerUpdateMessage({
    identifier,
    timestamp,
    expireTimer,
    syncTarget,
  });
};

export type SyncMessageType = VisibleMessage | ExpirationTimerUpdateMessage | ConfigurationMessage;

export const buildSyncMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  syncTarget: string,
  sentTimestamp: number
): VisibleMessage | ExpirationTimerUpdateMessage => {
  if (
    (dataMessage as any).constructor.name !== 'DataMessage' &&
    !(dataMessage instanceof SignalService.DataMessage)
  ) {
    window?.log?.warn('buildSyncMessage with something else than a DataMessage');
  }

  if (!sentTimestamp || !_.isNumber(sentTimestamp)) {
    throw new Error('Tried to build a sync message without a sentTimestamp');
  }
  // don't include our profileKey on syncing message. This is to be done by a ConfigurationMessage now
  const timestamp = _.toNumber(sentTimestamp);
  if (dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE) {
    return buildSyncExpireTimerMessage(identifier, dataMessage, timestamp, syncTarget);
  }
  return buildSyncVisibleMessage(identifier, dataMessage, timestamp, syncTarget);
};
