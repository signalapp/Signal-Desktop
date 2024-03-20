import _, { isEmpty } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { UserUtils } from '..';
import { getMessageQueue } from '../..';
import { Data } from '../../../data/data';
import { OpenGroupData } from '../../../data/opengroups';
import { ConversationModel } from '../../../models/conversation';
import { SignalService } from '../../../protobuf';
import { ECKeyPair } from '../../../receiver/keypairs';
import { ConfigurationSyncJobDone } from '../../../shims/events';
import { ReleasedFeatures } from '../../../util/releaseFeature';
import { Storage } from '../../../util/storage';
import { getCompleteUrlFromRoom } from '../../apis/open_group_api/utils/OpenGroupUtils';
import { SnodeNamespaces } from '../../apis/snode_api/namespaces';
import { DURATION } from '../../constants';
import { getConversationController } from '../../conversations';
import { DisappearingMessageUpdate } from '../../disappearing_messages/types';
import { DataMessage } from '../../messages/outgoing';
import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
  ConfigurationMessageContact,
} from '../../messages/outgoing/controlMessage/ConfigurationMessage';
import { ExpirationTimerUpdateMessage } from '../../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { MessageRequestResponse } from '../../messages/outgoing/controlMessage/MessageRequestResponse';
import { SharedConfigMessage } from '../../messages/outgoing/controlMessage/SharedConfigMessage';
import { UnsendMessage } from '../../messages/outgoing/controlMessage/UnsendMessage';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../../messages/outgoing/visibleMessage/VisibleMessage';
import { PubKey } from '../../types';
import { fromBase64ToArray, fromHexToArray } from '../String';
import { ConfigurationSync } from '../job_runners/jobs/ConfigurationSyncJob';

const ITEM_ID_LAST_SYNC_TIMESTAMP = 'lastSyncedTimestamp';

const getLastSyncTimestampFromDb = async (): Promise<number | undefined> =>
  (await Data.getItemById(ITEM_ID_LAST_SYNC_TIMESTAMP))?.value;

const writeLastSyncTimestampToDb = async (timestamp: number) =>
  Storage.put(ITEM_ID_LAST_SYNC_TIMESTAMP, timestamp);

/**
 * Conditionally Syncs user configuration with other devices linked.
 */
export const syncConfigurationIfNeeded = async () => {
  await ConfigurationSync.queueNewJobIfNeeded();

  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();
  if (!userConfigLibsession) {
    const lastSyncedTimestamp = (await getLastSyncTimestampFromDb()) || 0;
    const now = Date.now();

    // if the last sync was less than 2 days before, return early.
    if (Math.abs(now - lastSyncedTimestamp) < DURATION.DAYS * 2) {
      return;
    }

    const allConvos = getConversationController().getConversations();

    const configMessage = await getCurrentConfigurationMessage(allConvos);
    try {
      // window?.log?.info('syncConfigurationIfNeeded with', configMessage);

      await getMessageQueue().sendSyncMessage({
        namespace: SnodeNamespaces.UserMessages,
        message: configMessage,
      });
    } catch (e) {
      window?.log?.warn('Caught an error while sending our ConfigurationMessage:', e);
      // we do return early so that next time we use the old timestamp again
      // and so try again to trigger a sync
      return;
    }
    await writeLastSyncTimestampToDb(now);
  }
};

export const forceSyncConfigurationNowIfNeeded = async (waitForMessageSent = false) => {
  await ReleasedFeatures.checkIsUserConfigFeatureReleased();
  return new Promise(resolve => {
    // if we hang for more than 20sec, force resolve this promise.
    setTimeout(() => {
      resolve(false);
    }, 20000);

    // the ConfigurationSync also handles dumping in to the DB if we do not need to push the data, but the dumping needs to be done even before the feature flag is true.
    void ConfigurationSync.queueNewJobIfNeeded().catch(e => {
      window.log.warn(
        'forceSyncConfigurationNowIfNeeded scheduling of jobs ConfigurationSync.queueNewJobIfNeeded failed with: ',
        e.message
      );
    });
    if (ReleasedFeatures.isUserConfigFeatureReleasedCached()) {
      if (waitForMessageSent) {
        window.Whisper.events.once(ConfigurationSyncJobDone, () => {
          resolve(true);
        });
        return;
      }
      resolve(true);
      return;
    }
    const allConvos = getConversationController().getConversations();

    // eslint-disable-next-line more/no-then
    void getCurrentConfigurationMessage(allConvos)
      .then(configMessage => {
        // this just adds the message to the sending queue.
        // if waitForMessageSent is set, we need to effectively wait until then

        const callback = waitForMessageSent
          ? () => {
              resolve(true);
            }
          : undefined;
        void getMessageQueue().sendSyncMessage({
          namespace: SnodeNamespaces.UserMessages,
          message: configMessage,
          sentCb: callback as any,
        });
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
};

const getActiveOpenGroupV2CompleteUrls = async (
  convos: Array<ConversationModel>
): Promise<Array<string>> => {
  // Filter open groups v2
  const openGroupsV2ConvoIds = convos
    .filter(c => !!c.get('active_at') && c.isOpenGroupV2() && !c.get('left'))
    .map(c => c.id) as Array<string>;

  const urls = await Promise.all(
    openGroupsV2ConvoIds.map(async opengroupConvoId => {
      const roomInfos = OpenGroupData.getV2OpenGroupRoom(opengroupConvoId);

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
      c.isClosedGroup() &&
      c.get('members')?.includes(ourPubKey) &&
      !c.get('left') &&
      !c.get('isKickedFromGroup') &&
      !c.isBlocked() &&
      c.get('displayNameInProfile')
  );

  const closedGroups = await Promise.all(
    closedGroupModels.map(async c => {
      const groupPubKey = c.get('id');
      const fetchEncryptionKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(groupPubKey);
      if (!fetchEncryptionKeyPair) {
        return null;
      }

      return new ConfigurationMessageClosedGroup({
        publicKey: groupPubKey,
        name: c.get('displayNameInProfile') || '',
        members: c.get('members') || [],
        admins: c.get('groupAdmins') || [],
        encryptionKeyPair: ECKeyPair.fromHexKeyPair(fetchEncryptionKeyPair),
      });
    })
  );

  const onlyValidClosedGroup = closedGroups.filter(
    m => m !== null
  ) as Array<ConfigurationMessageClosedGroup>;
  return onlyValidClosedGroup;
};

const getValidContacts = (convos: Array<ConversationModel>) => {
  // Filter contacts
  // blindedId are synced with the outbox logic.
  const contactsModels = convos.filter(
    c =>
      !!c.get('active_at') &&
      c.getRealSessionUsername() &&
      c.isPrivate() &&
      c.isApproved() &&
      !PubKey.isBlinded(c.get('id'))
  );

  const contacts = contactsModels.map(c => {
    try {
      const profileKey = c.get('profileKey');
      let profileKeyForContact = null;
      if (typeof profileKey === 'string') {
        // this will throw if the profileKey is not in hex.
        try {
          // for some reason, at some point, the saved profileKey is a string in base64 format
          // this hack is here to update existing conversations with a non-hex profileKey to a hex format and save them

          if (!/^[0-9a-fA-F]+$/.test(profileKey)) {
            throw new Error('Not Hex');
          }
          profileKeyForContact = fromHexToArray(profileKey);
        } catch (e) {
          // if not hex, try to decode it as base64
          profileKeyForContact = fromBase64ToArray(profileKey);
          // if the line above does not fail, update the stored profileKey for this convo
          void c.setProfileKey(profileKeyForContact);
        }
      } else if (profileKey) {
        window.log.warn(
          'Got a profileKey for a contact in another format than string. Contact: ',
          c.id
        );
        return null;
      }

      return new ConfigurationMessageContact({
        publicKey: c.id as string,
        displayName: c.getRealSessionUsername() || 'Anonymous',
        profilePictureURL: c.get('avatarPointer'),
        profileKey: !profileKeyForContact?.length ? undefined : profileKeyForContact,
        isApproved: c.isApproved(),
        isBlocked: c.isBlocked(),
        didApproveMe: c.didApproveMe(),
      });
    } catch (e) {
      window?.log.warn('getValidContacts', e);
      return null;
    }
  });
  return _.compact(contacts);
};

export const getCurrentConfigurationMessage = async (
  convos: Array<ConversationModel>
): Promise<ConfigurationMessage> => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = convos.find(convo => convo.id === ourPubKey);

  const opengroupV2CompleteUrls = await getActiveOpenGroupV2CompleteUrls(convos);
  const onlyValidClosedGroup = await getValidClosedGroups(convos);
  const validContacts = getValidContacts(convos);

  if (!ourConvo) {
    window?.log?.error('Could not find our convo while building a configuration message.');
  }

  const ourProfileKeyHex =
    getConversationController().get(UserUtils.getOurPubKeyStrFromCache())?.get('profileKey') ||
    null;
  const profileKey = ourProfileKeyHex ? fromHexToArray(ourProfileKeyHex) : undefined;

  const profilePicture = ourConvo?.get('avatarPointer') || undefined;
  const displayName = ourConvo?.getRealSessionUsername() || 'Anonymous'; // this should never be undefined, but well...

  const activeOpenGroups = [...opengroupV2CompleteUrls];

  return new ConfigurationMessage({
    identifier: uuidv4(),
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
  syncTarget: string,
  expireUpdate?: DisappearingMessageUpdate
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
  const dataMessageExpireTimer = dataMessage.expireTimer;

  return new VisibleMessage({
    identifier,
    timestamp,
    attachments,
    body,
    quote,
    preview,
    syncTarget,
    expireTimer: expireUpdate?.expirationTimer || dataMessageExpireTimer,
    expirationType: expireUpdate?.expirationType || null,
  });
};

const buildSyncExpireTimerMessage = (
  identifier: string,
  expireUpdate: DisappearingMessageUpdate,
  timestamp: number,
  syncTarget: string
) => {
  const { expirationType, expirationTimer: expireTimer } = expireUpdate;

  return new ExpirationTimerUpdateMessage({
    identifier,
    timestamp,
    expirationType,
    expireTimer,
    syncTarget,
  });
};

export type SyncMessageType =
  | VisibleMessage
  | ExpirationTimerUpdateMessage
  | ConfigurationMessage
  | MessageRequestResponse
  | UnsendMessage
  | SharedConfigMessage;

export const buildSyncMessage = (
  identifier: string,
  data: DataMessage | SignalService.DataMessage,
  syncTarget: string,
  sentTimestamp: number,
  expireUpdate?: DisappearingMessageUpdate
): VisibleMessage | ExpirationTimerUpdateMessage | null => {
  if (
    (data as any).constructor.name !== 'DataMessage' &&
    !(data instanceof SignalService.DataMessage)
  ) {
    window?.log?.warn('buildSyncMessage with something else than a DataMessage');
  }

  const dataMessage = data instanceof DataMessage ? data.dataProto() : data;

  if (!sentTimestamp || !_.isNumber(sentTimestamp)) {
    throw new Error('Tried to build a sync message without a sentTimestamp');
  }
  // don't include our profileKey on syncing message. This is to be done by a ConfigurationMessage now
  const timestamp = _.toNumber(sentTimestamp);

  if (
    dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE &&
    !isEmpty(expireUpdate)
  ) {
    const expireTimerSyncMessage = buildSyncExpireTimerMessage(
      identifier,
      expireUpdate,
      timestamp,
      syncTarget
    );

    return expireTimerSyncMessage;
  }

  const visibleSyncMessage = buildSyncVisibleMessage(
    identifier,
    dataMessage,
    timestamp,
    syncTarget,
    expireUpdate
  );
  return visibleSyncMessage;
};
