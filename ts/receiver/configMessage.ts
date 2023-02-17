import _, { isEmpty, isEqual, isNil } from 'lodash';
import { ConfigDumpData } from '../data/configDump/configDump';
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
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { UserUtils } from '../session/utils';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { IncomingConfResult, LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { toHex } from '../session/utils/String';
import { configurationMessageReceived, trigger } from '../shims/events';
import { BlockedNumberController } from '../util';
import { getLastProfileUpdateTimestamp, setLastProfileUpdateTimestamp } from '../util/storage';
import {
  ContactsWrapperActions,
  GenericWrapperActions,
  UserConfigWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { removeFromCache } from './cache';
import { handleNewClosedGroup } from './closedGroups';
import { EnvelopePlus } from './types';

async function mergeConfigsWithIncomingUpdates(
  incomingConfig: IncomingMessage<SignalService.ISharedConfigMessage>
): Promise<{ kind: SignalService.SharedConfigMessage.Kind; result: IncomingConfResult }> {
  const { kind } = incomingConfig.message;

  const toMerge = [incomingConfig.message.data];

  const wrapperId = LibSessionUtil.kindToVariant(kind);
  await GenericWrapperActions.merge(wrapperId, toMerge);

  const needsPush = await GenericWrapperActions.needsPush(wrapperId);
  console.warn(`${wrapperId} needsPush? `, needsPush);
  const needsDump = await GenericWrapperActions.needsDump(wrapperId);
  console.warn(`${wrapperId} needsDump? `, needsDump);

  const messageHashes = [incomingConfig.messageHash];
  const latestSentTimestamp = incomingConfig.envelopeTimestamp;

  const incomingConfResult: IncomingConfResult = {
    latestSentTimestamp,
    messageHashes,
    needsDump,
    needsPush,
  };

  return { kind, result: incomingConfResult };
}

async function handleUserProfileUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  const updatedUserName = await UserConfigWrapperActions.getName();
  if (!result.needsDump) {
    return result;
  }

  const updatedProfilePicture = await UserConfigWrapperActions.getProfilePicture();
  const picUpdate = !isEmpty(updatedProfilePicture.key) && !isEmpty(updatedProfilePicture.url);
  await ProfileManager.updateOurProfileSync(
    updatedUserName,
    picUpdate ? updatedProfilePicture.url : null,
    picUpdate ? updatedProfilePicture.key : null
  );
  return result;
}

// tslint:disable-next-line: cyclomatic-complexity
async function handleContactsUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  if (!result.needsDump) {
    return result;
  }
  const us = UserUtils.getOurPubKeyStrFromCache();

  const allContacts = await ContactsWrapperActions.getAll();

  for (let index = 0; index < allContacts.length; index++) {
    const wrapperConvo = allContacts[index];

    if (wrapperConvo.id === us) {
      // our profile update comes from our userProfile, not from the contacts wrapper.
      continue;
    }

    const existingConvo = await getConversationController().getOrCreateAndWait(
      wrapperConvo.id,
      ConversationTypeEnum.PRIVATE
    );
    if (wrapperConvo.id && existingConvo) {
      let changes = false;

      // Note: the isApproved and didApproveMe flags are irreversible so they should only be updated when getting set to true
      if (
        !isNil(existingConvo.get('isApproved')) &&
        !isNil(wrapperConvo.approved) &&
        existingConvo.get('isApproved') !== wrapperConvo.approved
      ) {
        await existingConvo.setIsApproved(wrapperConvo.approved, false);
        changes = true;
      }

      if (
        !isNil(existingConvo.get('didApproveMe')) &&
        !isNil(wrapperConvo.approvedMe) &&
        existingConvo.get('didApproveMe') !== wrapperConvo.approvedMe
      ) {
        await existingConvo.setDidApproveMe(wrapperConvo.approvedMe, false);
        changes = true;
      }

      const convoBlocked = wrapperConvo.blocked || false;
      if (convoBlocked !== existingConvo.isBlocked()) {
        await BlockedNumberController.setBlocked(wrapperConvo.id, convoBlocked);
      }

      if (wrapperConvo.nickname !== existingConvo.getNickname()) {
        await existingConvo.setNickname(wrapperConvo.nickname || null, false);
        changes = true;
      }
      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await existingConvo.commit();
      }

      // we still need to handle the the `name` (synchronous) and the `profilePicture` (asynchronous)
      await ProfileManager.updateProfileOfContact(
        existingConvo.id,
        wrapperConvo.name,
        wrapperConvo.profilePicture?.url || null,
        wrapperConvo.profilePicture?.key || null
      );
    }
  }
  return result;
}

async function processMergingResults(
  envelope: EnvelopePlus,
  result: { kind: SignalService.SharedConfigMessage.Kind; result: IncomingConfResult }
) {
  const pubkey = envelope.source;

  const { kind, result: incomingResult } = result;

  if (!incomingResult) {
    await removeFromCache(envelope);
    return;
  }

  try {
    let finalResult = incomingResult;

    switch (kind) {
      case SignalService.SharedConfigMessage.Kind.USER_PROFILE:
        finalResult = await handleUserProfileUpdate(incomingResult);
        break;
      case SignalService.SharedConfigMessage.Kind.CONTACTS:
        finalResult = await handleContactsUpdate(incomingResult);
        break;
      default:
        throw new Error(`processMergingResults unknown kind of contact : ${kind}`);
    }
    const variant = LibSessionUtil.kindToVariant(kind);
    // We need to get the existing message hashes and combine them with the latest from the
    // service node to ensure the next push will properly clean up old messages
    const oldMessagesHashes = await ConfigDumpData.getCombinedHashesByVariantAndPubkey(
      variant,
      envelope.source
    );

    const allMessageHashes = [...oldMessagesHashes, ...finalResult.messageHashes];

    const finalResultsHashes = new Set(finalResult.messageHashes);

    // lodash does deep compare of Sets
    const messageHashesChanged = !isEqual(oldMessagesHashes, finalResultsHashes);

    if (finalResult.needsDump) {
      // The config data had changes so regenerate the dump and save it

      const dump = await GenericWrapperActions.dump(variant);
      await ConfigDumpData.saveConfigDump({
        data: dump,
        publicKey: pubkey,
        variant,
        combinedMessageHashes: allMessageHashes,
      });
    } else if (messageHashesChanged) {
      // The config data didn't change but there were different messages on the service node
      // so just update the message hashes so the next sync can properly remove any old ones
      await ConfigDumpData.saveCombinedMessageHashesForMatching({
        publicKey: pubkey,
        variant,
        combinedMessageHashes: allMessageHashes,
      });
    }

    console.warn('all dumps in DB: ', await ConfigDumpData.getAllDumpsWithoutData());
    await removeFromCache(envelope);
  } catch (e) {
    window.log.error(`processMergingResults failed with ${e.message}`);
    await removeFromCache(envelope);
    return;
  }

  // Now that the local state has been updated, trigger a config sync (this will push any
  // pending updates and properly update the state)
  if (result.result.needsPush) {
    console.warn(`processMergingResults  ${LibSessionUtil.kindToVariant(result.kind)} needs push`);
    await ConfigurationSync.queueNewJobIfNeeded();
  }
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

  window?.log?.info('Handling our profileUdpates via libsession_util.');

  const incomingMergeResult = await mergeConfigsWithIncomingUpdates(configMessage);

  await processMergingResults(envelope, incomingMergeResult);
}

async function handleOurProfileUpdateLegacy(
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

    await ProfileManager.updateOurProfileSync(displayName, profilePicture, profileKey);

    await setLastProfileUpdateTimestamp(_.toNumber(sentAt));
    // do not trigger a signin by linking if the display name is empty
    if (displayName) {
      trigger(configurationMessageReceived, displayName);
    } else {
      window?.log?.warn('Got a configuration message but the display name is empty');
    }
  }
}

async function handleGroupsAndContactsFromConfigMessageLegacy(
  envelope: EnvelopePlus,
  configMessage: SignalService.ConfigurationMessage
) {
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    return;
  }
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
    await handleClosedGroupsFromConfigLegacy(configMessage.closedGroups, envelope);
  }

  handleOpenGroupsFromConfig(configMessage.openGroups);

  if (configMessage.contacts?.length) {
    await Promise.all(
      configMessage.contacts.map(async c => handleContactFromConfigLegacy(c, envelope))
    );
  }
}

/**
 * Trigger a join for all open groups we are not already in.
 * @param openGroups string array of open group urls
 */
const handleOpenGroupsFromConfig = (openGroups: Array<string>) => {
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    return;
  }
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
const handleClosedGroupsFromConfigLegacy = async (
  closedGroups: Array<SignalService.ConfigurationMessage.IClosedGroup>,
  envelope: EnvelopePlus
) => {
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    return;
  }
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
const handleContactFromConfigLegacy = async (
  contactReceived: SignalService.ConfigurationMessage.IContact,
  envelope: EnvelopePlus
) => {
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    return;
  }
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

    await ProfileManager.updateProfileOfContact(
      contactConvo.id,
      profileInDataMessage.displayName || undefined,
      profileInDataMessage.profilePicture || null,
      contactReceived.profileKey || null
    );
  } catch (e) {
    window?.log?.warn('failed to handle  a new closed group from configuration message');
  }
};

/**
 * This is the legacy way of handling incoming configuration message.
 * Should not be used at all soon.
 */
async function handleConfigurationMessageLegacy(
  envelope: EnvelopePlus,
  configurationMessage: SignalService.ConfigurationMessage
): Promise<void> {
  if (window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    window?.log?.info(
      'useSharedUtilForUserConfig is set, not handling config messages with "handleConfigurationMessageLegacy()"'
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

  await handleOurProfileUpdateLegacy(envelope.timestamp, configurationMessage);

  await handleGroupsAndContactsFromConfigMessageLegacy(envelope, configurationMessage);

  await removeFromCache(envelope);
}

export const ConfigMessageHandler = {
  handleConfigurationMessageLegacy,
  handleConfigMessageViaLibSession,
};
