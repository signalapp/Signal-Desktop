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
} from '../messages/outgoing/content/ConfigurationMessage';
import { ConversationModel } from '../../models/conversation';
import { fromHexToArray } from './String';

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
    window.log.warn(
      'Caught an error while sending our ConfigurationMessage:',
      e
    );
    // we do return early so that next time we use the old timestamp again
    // and so try again to trigger a sync
    return;
  }
  await writeLastSyncTimestampToDb(now);
};

export const forceSyncConfigurationNowIfNeeded = async (
  waitForMessageSent = false
) =>
  new Promise(resolve => {
    const allConvos = ConversationController.getInstance().getConversations();

    void getCurrentConfigurationMessage(allConvos).then(configMessage => {
      // console.warn('forceSyncConfigurationNowIfNeeded with', configMessage);

      try {
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
      } catch (e) {
        window.log.warn(
          'Caught an error while sending our ConfigurationMessage:',
          e
        );
        resolve(false);
      }
    });
  });

export const getCurrentConfigurationMessage = async (
  convos: Array<ConversationModel>
) => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = convos.find(convo => convo.id === ourPubKey);

  // Filter open groups
  const openGroupsIds = convos
    .filter(c => !!c.get('active_at') && c.isPublic() && !c.get('left'))
    .map(c => c.id.substring((c.id as string).lastIndexOf('@') + 1)) as Array<
    string
  >;

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
      const fetchEncryptionKeyPair = await getLatestClosedGroupEncryptionKeyPair(
        groupPubKey
      );
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

  // Filter contacts
  const contactsModels = convos.filter(
    c =>
      !!c.get('active_at') &&
      c.getLokiProfile()?.displayName &&
      c.isPrivate() &&
      !c.isBlocked()
  );

  const contacts = contactsModels.map(c => {
    const profileKeyForContact = c.get('profileKey')
      ? fromHexToArray(c.get('profileKey') as string)
      : undefined;

    return new ConfigurationMessageContact({
      publicKey: c.id,
      displayName: c.getLokiProfile()?.displayName,
      profilePictureURL: c.get('avatarPointer'),
      profileKey: profileKeyForContact,
    });
  });

  if (!ourConvo) {
    window.log.error(
      'Could not find our convo while building a configuration message.'
    );
  }
  const profileKeyFromStorage = window.storage.get('profileKey');
  const profileKey = profileKeyFromStorage
    ? new Uint8Array(profileKeyFromStorage)
    : undefined;

  const profilePicture = ourConvo?.get('avatarPointer') || undefined;
  const displayName = ourConvo?.getLokiProfile()?.displayName || undefined;

  return new ConfigurationMessage({
    identifier: uuid(),
    timestamp: Date.now(),
    activeOpenGroups: openGroupsIds,
    activeClosedGroups: onlyValidClosedGroup,
    displayName,
    profilePicture,
    profileKey,
    contacts,
  });
};
