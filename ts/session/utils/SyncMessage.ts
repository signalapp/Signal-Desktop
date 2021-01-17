import * as _ from 'lodash';
import { BlockedNumberController, UserUtil } from '../../util';
import { getAllConversations } from '../../../js/modules/data';
import { MultiDeviceProtocol } from '../protocols';
import ByteBuffer from 'bytebuffer';
import {
  BlockedListSyncMessage,
  ClosedGroupSyncMessage,
  ContentMessage,
  DataMessage,
  OpenGroupSyncMessage,
  SentSyncMessage,
  SyncReadMessage,
} from '../messages/outgoing';
import { PubKey } from '../types';
import { ConversationController } from '../conversations';
import { ConversationModel } from '../../../js/models/conversations';
import { getMessageQueue } from '../instance';
import { syncMediumGroups } from '../groupv2';

export function getSentSyncMessage(params: {
  message: ContentMessage;
  expirationStartTimestamp?: number;
  sentTo?: Array<PubKey>;
  destination: PubKey | string;
}): SentSyncMessage | undefined {
  if (!(params.message instanceof DataMessage)) {
    return undefined;
  }

  const pubKey = PubKey.cast(params.destination);
  return new SentSyncMessage({
    timestamp: Date.now(),
    identifier: params.message.identifier,
    destination: pubKey,
    dataMessage: params.message.dataProto(),
    expirationStartTimestamp: params.expirationStartTimestamp,
    sentTo: params.sentTo,
  });
}

export async function getSyncContacts(): Promise<Array<ConversationModel>> {
  const thisDevice = await UserUtil.getCurrentDevicePubKey();

  if (!thisDevice) {
    return [];
  }

  const conversations = await getAllConversations({
    ConversationCollection: window.Whisper.ConversationCollection,
  });

  // We are building a set of all contacts
  const primaryContacts =
    conversations.filter(
      c =>
        c.isPrivate() &&
        !c.isOurLocalDevice() &&
        !c.isBlocked() &&
        !c.attributes.secondaryStatus &&
        !!c.get('active_at')
    ) || [];

  // Return unique contacts
  return primaryContacts;
}

export async function filterOpenGroupsConvos(
  conversations: Array<any>
): Promise<Array<any> | undefined> {
  // If we haven't got a primaryDeviceKey then we are in the middle of pairing
  // primaryDevicePubKey is set to our own number if we are the master device
  const thisDevice = await UserUtil.getCurrentDevicePubKey();

  if (!thisDevice) {
    return [];
  }

  // We only want to sync across open groups that we haven't left
  return conversations.filter(
    c => c.isPublic() && !c.isRss() && !c.get('left')
  );
}

// Serialise as <Element0.length><Element0><Element1.length><Element1>...
// This is an implementation of the reciprocal of contacts_parser.js
export function serialiseByteBuffers(buffers: Array<Uint8Array>): ByteBuffer {
  const result = new ByteBuffer();
  buffers.forEach(buffer => {
    // bytebuffer container expands and increments
    // offset automatically
    result.writeInt32(buffer.length);
    result.append(buffer);
  });
  result.limit = result.offset;
  result.reset();
  return result;
}

export async function sendContactSyncMessage(convos: Array<ConversationModel>) {
  window.log.warn('sendContactSyncMessage TODO');
  return;
  // let convosToSync: Array<ConversationModel>;
  // if (!convos?.length) {
  //   convosToSync = await getSyncContacts();
  // } else {
  //   convosToSync = convos;
  // }

  // if (convosToSync?.length === 0) {
  //   window.log.info('No contacts to sync.');

  //   return Promise.resolve();
  // }

  // // We need to sync across 3 contacts at a time
  // // This is to avoid hitting storage server limit
  // const chunked = _.chunk(convosToSync, 3);
  // const syncMessages = await Promise.all(
  //   chunked.map(c => createContactSyncMessage(c))
  // );

  // const syncPromises = syncMessages.map(syncMessage =>
  //   getMessageQueue().sendSyncMessage(syncMessage)
  // );

  // return Promise.all(syncPromises);
}

function createGroupSyncMessage(sessionGroup: any) {
  // We are getting a single open group here

  // const rawGroup = {
  //   id: sessionGroup.id,
  //   name: sessionGroup.get('name'),
  //   members: sessionGroup.get('members') || [],
  //   blocked: sessionGroup.isBlocked(),
  //   expireTimer: sessionGroup.get('expireTimer'),
  //   admins: sessionGroup.get('groupAdmins') || [],
  // };

  throw new Error('Still in use?');

  // return new ClosedGroupSyncMessage({
  //   timestamp: Date.now(),
  //   rawGroup,
  // });
}

async function createContactSyncMessage(sessionContacts: Array<any>) {
  if (sessionContacts.length === 0) {
    return null;
  }

  const rawContacts = await Promise.all(
    sessionContacts.map(async conversation => {
      const profile = conversation.getLokiProfile();
      const name = profile
        ? profile.displayName
        : conversation.getProfileName();

      return {
        name,
        number: conversation.getNumber(),
        nickname: conversation.getNickname(),
        blocked: conversation.isBlocked(),
        expireTimer: conversation.get('expireTimer'),
      };
    })
  );

  throw new Error('Still in use?');

  // return new ContactSyncMessage({
  //   timestamp: Date.now(),
  //   rawContacts,
  // });
}

export async function sendGroupSyncMessage(
  conversations: Array<ConversationModel>
) {
  window.log.warn('sendGroupSyncMessage TODO');
  return;
  // If we havn't got a primaryDeviceKey then we are in the middle of pairing
  // primaryDevicePubKey is set to our own number if we are the master device
  // const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
  // if (!primaryDeviceKey) {
  //   window.log.debug('sendGroupSyncMessage: no primary device pubkey');
  //   return Promise.resolve();
  // }
  // // We only want to sync across closed groups that we haven't left
  // const activeGroups = conversations.filter(
  //   c => c.isClosedGroup() && !c.get('left') && !c.get('isKickedFromGroup')
  // );
  // if (activeGroups.length === 0) {
  //   window.log.info('No closed group to sync.');
  //   return Promise.resolve();
  // }

  // const mediumGroups = activeGroups.filter(c => c.isMediumGroup());

  // syncMediumGroups(mediumGroups);

  // const legacyGroups = activeGroups.filter(c => !c.isMediumGroup());

  // // We need to sync across 1 group at a time
  // // This is because we could hit the storage server limit with one group
  // const syncPromises = legacyGroups
  //   .map(c => createGroupSyncMessage(c))
  //   .map(syncMessage => getMessageQueue().sendSyncMessage(syncMessage));

  // return Promise.all(syncPromises);
}

export async function sendOpenGroupsSyncMessage(
  convos: Array<ConversationModel>
) {
  window.log.warn('sendOpenGroupsSyncMessage TODO');
  return;

  // If we havn't got a primaryDeviceKey then we are in the middle of pairing
  // primaryDevicePubKey is set to our own number if we are the master device
  // const primaryDeviceKey = (await UserUtil.getPrimary()).key;
  // if (!primaryDeviceKey) {
  //   return Promise.resolve();
  // }
  // const conversations = Array.isArray(convos) ? convos : [convos];

  // const openGroupsConvos = await filterOpenGroupsConvos(conversations);

  // if (!openGroupsConvos?.length) {
  //   window.log.info('No open groups to sync');
  //   return Promise.resolve();
  // }

  // // Send the whole list of open groups in a single message
  // const openGroupsDetails = openGroupsConvos.map(conversation => ({
  //   url: conversation.id,
  //   channelId: conversation.get('channelId'),
  // }));
  // const openGroupsSyncParams = {
  //   timestamp: Date.now(),
  //   openGroupsDetails,
  // };
  // const openGroupsSyncMessage = new OpenGroupSyncMessage(openGroupsSyncParams);

  // return getMessageQueue().sendSyncMessage(openGroupsSyncMessage);
}

export async function sendBlockedListSyncMessage() {
  window.log.warn('sendBlockedListSyncMessage TODO');
  return;
  // If we havn't got a primaryDeviceKey then we are in the middle of pairing
  // primaryDevicePubKey is set to our own number if we are the master device
  // const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
  // if (!primaryDeviceKey) {
  //   return Promise.resolve();
  // }

  // const currentlyBlockedNumbers = BlockedNumberController.getBlockedNumbers();

  // // currently we only sync user blocked, not groups
  // const blockedSyncMessage = new BlockedListSyncMessage({
  //   timestamp: Date.now(),
  //   numbers: currentlyBlockedNumbers,
  //   groups: [],
  // });
  // return getMessageQueue().sendSyncMessage(blockedSyncMessage);
}

export async function syncReadMessages() {
  window.log.warn('syncReadMessages TODO');
  return;
  // FIXME currently not in used
  // const syncReadMessages = new SyncReadMessage(
  //   {
  //     timestamp: Date.now(),
  //     readMessages: reads,
  //   }
  // );
  // return libsession.getMessageQueue().sendSyncMessage(syncReadMessages);
}
