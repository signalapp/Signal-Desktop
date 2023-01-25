import _, { isEmpty } from 'lodash';
import { ContactInfo, ProfilePicture } from 'session_util_wrapper';
import { Data, hasSyncedInitialConfigurationItem } from '../data/data';
import { ConversationInteraction } from '../interactions';
import { ConversationTypeEnum } from '../models/conversationAttributes';
import { SignalService } from '../protobuf';
import {
  joinOpenGroupV2WithUIEvents,
  parseOpenGroupV2,
} from '../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { getOpenGroupV2ConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getConversationController } from '../session/conversations';
import { IncomingMessage } from '../session/messages/incoming/IncomingMessage';
import { UserUtils } from '../session/utils';
import { toHex } from '../session/utils/String';
import { configurationMessageReceived, trigger } from '../shims/events';
import { BlockedNumberController } from '../util';
import { getLastProfileUpdateTimestamp, setLastProfileUpdateTimestamp } from '../util/storage';
import { ConfigWrapperObjectTypes } from '../webworker/workers/browser/libsession_worker_functions';
import { callLibSessionWorker } from '../webworker/workers/browser/libsession_worker_interface';
import { removeFromCache } from './cache';
import { handleNewClosedGroup } from './closedGroups';
import { EnvelopePlus } from './types';
import { appendFetchAvatarAndProfileJob, updateOurProfileSync } from './userProfileImageUpdates';

type IncomingConfResult = {
  needsPush: boolean;
  needsDump: boolean;
  messageHashes: Array<string>;
  latestSentTimestamp: number;
};

function protobufSharedConfigTypeToWrapper(
  kind: SignalService.SharedConfigMessage.Kind
): ConfigWrapperObjectTypes | null {
  switch (kind) {
    case SignalService.SharedConfigMessage.Kind.USER_PROFILE:
      return 'UserConfig';
    case SignalService.SharedConfigMessage.Kind.CONTACTS:
      return 'ContactsConfig';
    default:
      return null;
  }
}

async function mergeConfigsWithIncomingUpdates(
  incomingConfig: IncomingMessage<SignalService.ISharedConfigMessage>
) {
  const kindMessageMap: Map<SignalService.SharedConfigMessage.Kind, IncomingConfResult> = new Map();
  const allKinds = [incomingConfig.message.kind];
  for (let index = 0; index < allKinds.length; index++) {
    const kind = allKinds[index];

    const currentKindMessages = [incomingConfig];
    if (!currentKindMessages) {
      continue;
    }
    const toMerge = currentKindMessages.map(m => m.message.data);

    const wrapperId = protobufSharedConfigTypeToWrapper(kind);
    if (!wrapperId) {
      throw new Error(`Invalid kind: ${kind}`);
    }

    await callLibSessionWorker([wrapperId, 'merge', toMerge]);
    const needsPush = ((await callLibSessionWorker([wrapperId, 'needsPush'])) || false) as boolean;
    const needsDump = ((await callLibSessionWorker([wrapperId, 'needsDump'])) || false) as boolean;
    const messageHashes = currentKindMessages.map(m => m.messageHash);
    const latestSentTimestamp = Math.max(...currentKindMessages.map(m => m.envelopeTimestamp));

    const incomingConfResult: IncomingConfResult = {
      latestSentTimestamp,
      messageHashes,
      needsDump,
      needsPush,
    };
    kindMessageMap.set(kind, incomingConfResult);
  }

  return kindMessageMap;
}

async function handleUserProfileUpdate(result: IncomingConfResult) {
  if (result.needsDump) {
    return;
  }

  const updatedUserName = (await callLibSessionWorker(['UserConfig', 'getName'])) as
    | string
    | undefined;
  const updatedProfilePicture = (await callLibSessionWorker([
    'UserConfig',
    'getProfilePicture',
  ])) as ProfilePicture;

  // fetch our own conversation
  const userPublicKey = UserUtils.getOurPubKeyStrFromCache();
  if (!userPublicKey) {
    return;
  }

  const picUpdate = !isEmpty(updatedProfilePicture.key) && !isEmpty(updatedProfilePicture.url);

  // trigger an update of our profileName and picture if there is one.
  // this call checks for differences between updating anything
  void updateOurProfileSync(
    { displayName: updatedUserName, profilePicture: picUpdate ? updatedProfilePicture.url : null },
    picUpdate ? updatedProfilePicture.key : null
  );
}

async function handleContactsUpdate(result: IncomingConfResult) {
  if (result.needsDump) {
    return;
  }

  const allContacts = (await callLibSessionWorker(['ContactsConfig', 'getAll'])) as Array<
    ContactInfo
  >;

  for (let index = 0; index < allContacts.length; index++) {
    const wrapperConvo = allContacts[index];

    if (wrapperConvo.id && getConversationController().get(wrapperConvo.id)) {
      const existingConvo = getConversationController().get(wrapperConvo.id);
      let changes = false;

      // Note: the isApproved and didApproveMe flags are irreversible so they should only be updated when getting set to true
      if (
        existingConvo.get('isApproved') !== undefined &&
        wrapperConvo.approved !== undefined &&
        existingConvo.get('isApproved') !== wrapperConvo.approved
      ) {
        await existingConvo.setIsApproved(wrapperConvo.approved, false);
        changes = true;
      }

      if (
        existingConvo.get('didApproveMe') !== undefined &&
        wrapperConvo.approvedMe !== undefined &&
        existingConvo.get('didApproveMe') !== wrapperConvo.approvedMe
      ) {
        await existingConvo.setDidApproveMe(wrapperConvo.approvedMe, false);
        changes = true;
      }

      const convoBlocked = wrapperConvo.blocked || false;
      if (convoBlocked !== existingConvo.isBlocked()) {
        if (existingConvo.isPrivate()) {
          await BlockedNumberController.setBlocked(wrapperConvo.id, convoBlocked);
        } else {
          await BlockedNumberController.setGroupBlocked(wrapperConvo.id, convoBlocked);
        }
      }

      if (wrapperConvo.nickname !== existingConvo.getNickname()) {
        await existingConvo.setNickname(wrapperConvo.nickname || null, false);
        changes = true;
      }
      // make sure to write the changes to the database now as the `appendFetchAvatarAndProfileJob` call below might take some time before getting run
      if (changes) {
        await existingConvo.commit();
      }

      // we still need to handle the the `name` and the `profilePicture` but those are currently made asynchronously
      void appendFetchAvatarAndProfileJob(
        existingConvo.id,
        {
          displayName: wrapperConvo.name,
          profilePicture: wrapperConvo.profilePicture?.url || null,
        },
        wrapperConvo.profilePicture?.key || null
      );
    }
  }
}

async function processMergingResults(
  envelope: EnvelopePlus,
  results: Map<SignalService.SharedConfigMessage.Kind, IncomingConfResult>
) {
  const keys = [...results.keys()];

  for (let index = 0; index < keys.length; index++) {
    const kind = keys[index];
    const result = results.get(kind);

    if (!result) {
      continue;
    }

    try {
      switch (kind) {
        case SignalService.SharedConfigMessage.Kind.USER_PROFILE:
          await handleUserProfileUpdate(result);
          break;
        case SignalService.SharedConfigMessage.Kind.CONTACTS:
          await handleContactsUpdate(result);
          break;
      }
    } catch (e) {
      throw e;
    }
  }
  await removeFromCache(envelope);
}

async function handleConfigMessageViaLibSession(
  envelope: EnvelopePlus,
  configMessage: IncomingMessage<SignalService.ISharedConfigMessage>
) {
  // FIXME: Remove this once `useSharedUtilForUserConfig` is permanent
  if (!window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    await removeFromCache(envelope);
    return;
  }

  if (!configMessage) {
    await removeFromCache(envelope);

    return;
  }

  window?.log?.info(`Handling our profileUdpates via libsession_util.`);

  const kindMessagesMap = await mergeConfigsWithIncomingUpdates(configMessage);

  await processMergingResults(envelope, kindMessagesMap);
}

async function handleOurProfileUpdate(
  sentAt: number | Long,
  configMessage: SignalService.ConfigurationMessage
) {
  // this call won't be needed with the new sharedUtilLibrary
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    return;
  }
  const latestProfileUpdateTimestamp = getLastProfileUpdateTimestamp();
  if (!latestProfileUpdateTimestamp || sentAt > latestProfileUpdateTimestamp) {
    window?.log?.info(
      `Handling our profileUdpate ourLastUpdate:${latestProfileUpdateTimestamp}, envelope sent at: ${sentAt}`
    );
    const { profileKey, profilePicture, displayName } = configMessage;

    const lokiProfile = {
      displayName,
      profilePicture,
    };
    await updateOurProfileSync(lokiProfile, profileKey);
    await setLastProfileUpdateTimestamp(_.toNumber(sentAt));
    // do not trigger a signin by linking if the display name is empty
    if (displayName) {
      trigger(configurationMessageReceived, displayName);
    } else {
      window?.log?.warn('Got a configuration message but the display name is empty');
    }
  }
}

async function handleGroupsAndContactsFromConfigMessage(
  envelope: EnvelopePlus,
  configMessage: SignalService.ConfigurationMessage
) {
  const envelopeTimestamp = _.toNumber(envelope.timestamp);
  const lastConfigUpdate = await Data.getItemById(hasSyncedInitialConfigurationItem);
  const lastConfigTimestamp = lastConfigUpdate?.timestamp;
  const isNewerConfig =
    !lastConfigTimestamp || (lastConfigTimestamp && lastConfigTimestamp < envelopeTimestamp);

  if (!isNewerConfig) {
    window?.log?.info('Received outdated configuration message... Dropping message.');
    return;
  }

  await Data.createOrUpdateItem({
    id: 'hasSyncedInitialConfigurationItem',
    value: true,
    timestamp: envelopeTimestamp,
  });

  // we only want to apply changes to closed groups if we never got them
  // new opengroups get added when we get a new closed group message from someone, or a sync'ed message from outself creating the group
  if (!lastConfigTimestamp) {
    await handleClosedGroupsFromConfig(configMessage.closedGroups, envelope);
  }

  handleOpenGroupsFromConfig(configMessage.openGroups);

  if (configMessage.contacts?.length) {
    await Promise.all(configMessage.contacts.map(async c => handleContactFromConfig(c, envelope)));
  }
}

/**
 * Trigger a join for all open groups we are not already in.
 * @param openGroups string array of open group urls
 */
const handleOpenGroupsFromConfig = (openGroups: Array<string>) => {
  const numberOpenGroup = openGroups?.length || 0;
  for (let i = 0; i < numberOpenGroup; i++) {
    const currentOpenGroupUrl = openGroups[i];
    const parsedRoom = parseOpenGroupV2(currentOpenGroupUrl);
    if (!parsedRoom) {
      continue;
    }
    const roomConvoId = getOpenGroupV2ConversationId(parsedRoom.serverUrl, parsedRoom.roomId);
    if (!getConversationController().get(roomConvoId)) {
      window?.log?.info(
        `triggering join of public chat '${currentOpenGroupUrl}' from ConfigurationMessage`
      );
      void joinOpenGroupV2WithUIEvents(currentOpenGroupUrl, false, true);
    }
  }
};

/**
 * Trigger a join for all closed groups which doesn't exist yet
 * @param openGroups string array of open group urls
 */
const handleClosedGroupsFromConfig = async (
  closedGroups: Array<SignalService.ConfigurationMessage.IClosedGroup>,
  envelope: EnvelopePlus
) => {
  const numberClosedGroup = closedGroups?.length || 0;

  window?.log?.info(
    `Received ${numberClosedGroup} closed group on configuration. Creating them... `
  );
  await Promise.all(
    closedGroups.map(async c => {
      const groupUpdate = new SignalService.DataMessage.ClosedGroupControlMessage({
        type: SignalService.DataMessage.ClosedGroupControlMessage.Type.NEW,
        encryptionKeyPair: c.encryptionKeyPair,
        name: c.name,
        admins: c.admins,
        members: c.members,
        publicKey: c.publicKey,
      });
      try {
        // TODO we should not drop the envelope from cache as long as we are still handling a new closed group from that same envelope
        // check the removeFromCache inside handleNewClosedGroup()
        await handleNewClosedGroup(envelope, groupUpdate);
      } catch (e) {
        window?.log?.warn('failed to handle  a new closed group from configuration message');
      }
    })
  );
};

/**
 * Handles adding of a contact and setting approval/block status
 * @param contactReceived Contact to sync
 */
const handleContactFromConfig = async (
  contactReceived: SignalService.ConfigurationMessage.IContact,
  envelope: EnvelopePlus
) => {
  try {
    if (!contactReceived.publicKey?.length) {
      return;
    }
    const contactConvo = await getConversationController().getOrCreateAndWait(
      toHex(contactReceived.publicKey),
      ConversationTypeEnum.PRIVATE
    );
    const profileInDataMessage: SignalService.DataMessage.ILokiProfile = {
      displayName: contactReceived.name,
      profilePicture: contactReceived.profilePicture,
    };

    const existingActiveAt = contactConvo.get('active_at');
    if (!existingActiveAt || existingActiveAt === 0) {
      contactConvo.set('active_at', _.toNumber(envelope.timestamp));
    }

    // checking for existence of field on protobuf
    if (contactReceived.isApproved === true) {
      if (!contactConvo.isApproved()) {
        await contactConvo.setIsApproved(Boolean(contactReceived.isApproved));
        await contactConvo.addOutgoingApprovalMessage(_.toNumber(envelope.timestamp));
      }

      if (contactReceived.didApproveMe === true) {
        // checking for existence of field on message
        await contactConvo.setDidApproveMe(Boolean(contactReceived.didApproveMe));
      }
    }

    // only set for explicit true/false values incase outdated sender doesn't have the fields
    if (contactReceived.isBlocked === true) {
      if (contactConvo.isIncomingRequest()) {
        // handling case where restored device's declined message requests were getting restored
        await ConversationInteraction.deleteAllMessagesByConvoIdNoConfirmation(contactConvo.id);
      }
      await BlockedNumberController.block(contactConvo.id);
    } else if (contactReceived.isBlocked === false) {
      await BlockedNumberController.unblock(contactConvo.id);
    }

    void appendFetchAvatarAndProfileJob(
      contactConvo.id,
      profileInDataMessage,
      contactReceived.profileKey
    );
  } catch (e) {
    window?.log?.warn('failed to handle  a new closed group from configuration message');
  }
};

/**
 * This is the legacy way of handling incoming configuration message.
 * Should not be used at all soon.
 */
async function handleConfigurationMessage(
  envelope: EnvelopePlus,
  configurationMessage: SignalService.ConfigurationMessage
): Promise<void> {
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    window?.log?.info(
      'useSharedUtilForUserConfig is set, not handling config messages with "handleConfigurationMessage()"'
    );
    await removeFromCache(envelope);
    return;
  }

  window?.log?.info('Handling configuration message');
  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubkey) {
    return;
  }

  if (envelope.source !== ourPubkey) {
    window?.log?.info('Dropping configuration change from someone else than us.');
    return removeFromCache(envelope);
  }

  await handleOurProfileUpdate(envelope.timestamp, configurationMessage);

  await handleGroupsAndContactsFromConfigMessage(envelope, configurationMessage);

  await removeFromCache(envelope);
}

export const ConfigMessageHandler = {
  handleConfigurationMessage,
  handleConfigMessageViaLibSession,
};
