import {
  createOrUpdateItem,
  getItemById,
  getLatestClosedGroupEncryptionKeyPair,
} from '../../../ts/data/data';
import { getMessageQueue } from '..';
import { ConversationController } from '../conversations';
import { DAYS } from './Number';
import uuid from 'uuid';
import { UserUtils } from '.';
import { ECKeyPair } from '../../receiver/keypairs';
import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
  ConfigurationMessageContact,
} from '../messages/outgoing/controlMessage/ConfigurationMessage';
import { ConversationModel } from '../../models/conversation';
import { fromBase64ToArray, fromBase64ToArrayBuffer, fromHexToArray } from './String';
import { fromBase64 } from 'bytebuffer';
import { SignalService } from '../../protobuf';
import _ from 'lodash';
import {
  AttachmentPointer,
  Preview,
  Quote,
  VisibleMessage,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { ExpirationTimerUpdateMessage } from '../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { getV2OpenGroupRoom } from '../../data/opengroups';
import { getCompleteUrlFromRoom } from '../../opengroup/utils/OpenGroupUtils';

const ITEM_ID_LAST_SYNC_TIMESTAMP = 'lastSyncedTimestamp';

const getLastSyncTimestampFromDb = async (): Promise<number | undefined> =>
  (await getItemById(ITEM_ID_LAST_SYNC_TIMESTAMP))?.value;

const writeLastSyncTimestampToDb = async (timestamp: number) =>
  createOrUpdateItem({ id: ITEM_ID_LAST_SYNC_TIMESTAMP, value: timestamp });

export const syncConfigurationIfNeeded = async () => {
  const lastSyncedTimestamp = (await getLastSyncTimestampFromDb()) || 0;
  const now = Date.now();

  // if the last sync was less than 2 days before, return early.
  if (Math.abs(now - lastSyncedTimestamp) < DAYS * 2) {
    return;
  }

  const allConvos = ConversationController.getInstance().getConversations();
  const configMessage = await getCurrentConfigurationMessage(allConvos);
  try {
    // window.log.info('syncConfigurationIfNeeded with', configMessage);

    await getMessageQueue().sendSyncMessage(configMessage);
  } catch (e) {
    window.log.warn('Caught an error while sending our ConfigurationMessage:', e);
    // we do return early so that next time we use the old timestamp again
    // and so try again to trigger a sync
    return;
  }
  await writeLastSyncTimestampToDb(now);
};

export const forceSyncConfigurationNowIfNeeded = async (waitForMessageSent = false) =>
  new Promise(resolve => {
    const allConvos = ConversationController.getInstance().getConversations();

    void getCurrentConfigurationMessage(allConvos)
      .then(configMessage => {
        // console.warn('forceSyncConfigurationNowIfNeeded with', configMessage);

        // this just adds the message to the sending queue.
        // if waitForMessageSent is set, we need to effectively wait until then
        // tslint:disable-next-line: no-void-expression
        const callback = waitForMessageSent
          ? () => {
              resolve(true);
            }
          : undefined;
        void getMessageQueue().sendSyncMessage(configMessage, callback as any);
        // either we resolve from the callback if we need to wait for it,
        // or we don't want to wait, we resolve it here.
        if (!waitForMessageSent) {
          resolve(true);
        }
      })
      .catch(e => {
        window.log.warn('Caught an error while building our ConfigurationMessage:', e);
        resolve(false);
      });
  });

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
    const profileKeyForContact = c.get('profileKey')
      ? fromBase64ToArray(c.get('profileKey') as string)
      : undefined;

    return new ConfigurationMessageContact({
      publicKey: c.id,
      displayName: c.getLokiProfile()?.displayName,
      profilePictureURL: c.get('avatarPointer'),
      profileKey: profileKeyForContact,
    });
  });
  return contacts;
};

export const getCurrentConfigurationMessage = async (convos: Array<ConversationModel>) => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = convos.find(convo => convo.id === ourPubKey);

  // Filter open groups v1
  const openGroupsV1Ids = convos
    .filter(c => !!c.get('active_at') && c.isOpenGroupV1() && !c.get('left'))
    .map(c => c.id.substring((c.id as string).lastIndexOf('@') + 1)) as Array<string>;

  const opengroupV2CompleteUrls = await getActiveOpenGroupV2CompleteUrls(convos);
  const onlyValidClosedGroup = await getValidClosedGroups(convos);
  const validContacts = getValidContacts(convos);

  if (!ourConvo) {
    window.log.error('Could not find our convo while building a configuration message.');
  }
  const profileKeyFromStorage = window.storage.get('profileKey');
  const profileKey = profileKeyFromStorage ? new Uint8Array(profileKeyFromStorage) : undefined;

  const profilePicture = ourConvo?.get('avatarPointer') || undefined;
  const displayName = ourConvo?.getLokiProfile()?.displayName || undefined;

  const activeOpenGroups = [...openGroupsV1Ids, ...opengroupV2CompleteUrls];

  console.warn('SyncConfiguration', activeOpenGroups);

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
  }) as Array<AttachmentPointer>;
  const quote = (dataMessage.quote as Quote) || undefined;
  const preview = (dataMessage.preview as Array<Preview>) || [];
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
    window.log.warn('buildSyncMessage with something else than a DataMessage');
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
