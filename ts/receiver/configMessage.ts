import _, { compact, isEmpty } from 'lodash';
import { ConfigDumpData } from '../data/configDump/configDump';
import { Data, hasSyncedInitialConfigurationItem } from '../data/data';
import { ConversationInteraction } from '../interactions';
import { ConversationTypeEnum } from '../models/conversationAttributes';
import { SignalService } from '../protobuf';
import {
  joinOpenGroupV2WithUIEvents,
  parseOpenGroupV2,
} from '../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { getOpenGroupManager } from '../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { getOpenGroupV2ConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getConversationController } from '../session/conversations';
import { IncomingMessage } from '../session/messages/incoming/IncomingMessage';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { UserUtils } from '../session/utils';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { IncomingConfResult, LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { SessionUtilUserGroups } from '../session/utils/libsession/libsession_utils_user_groups';
import { toHex } from '../session/utils/String';
import { configurationMessageReceived, trigger } from '../shims/events';
import { BlockedNumberController } from '../util';
import { getLastProfileUpdateTimestamp, setLastProfileUpdateTimestamp } from '../util/storage';
import {
  ContactsWrapperActions,
  GenericWrapperActions,
  UserConfigWrapperActions,
  UserGroupsWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { removeFromCache } from './cache';
import { handleNewClosedGroup } from './closedGroups';
import { EnvelopePlus } from './types';

async function mergeConfigsWithIncomingUpdates(
  incomingConfig: IncomingMessage<SignalService.ISharedConfigMessage>
): Promise<{ kind: SignalService.SharedConfigMessage.Kind; result: IncomingConfResult }> {
  const { kind } = incomingConfig.message;

  const toMerge = [{ data: incomingConfig.message.data, hash: incomingConfig.messageHash }];
  const wrapperId = LibSessionUtil.kindToVariant(kind);
  try {
    await GenericWrapperActions.merge(wrapperId, toMerge);
    const needsPush = await GenericWrapperActions.needsPush(wrapperId);
    const needsDump = await GenericWrapperActions.needsDump(wrapperId);
    window.log.info(`${wrapperId} needsPush:${needsPush} needsDump:${needsDump} `);

    const messageHashes = [incomingConfig.messageHash];
    const latestSentTimestamp = incomingConfig.envelopeTimestamp;

    const incomingConfResult: IncomingConfResult = {
      latestSentTimestamp,
      messageHashes,
      needsDump,
      needsPush,
    };

    return { kind, result: incomingConfResult };
  } catch (e) {
    window.log.error('mergeConfigsWithIncomingUpdates failed with', e);
    throw e;
  }
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

      // the display name set is handled in `updateProfileOfContact`
      if (wrapperConvo.nickname !== existingConvo.getNickname()) {
        await existingConvo.setNickname(wrapperConvo.nickname || null, false);
        changes = true;
      }

      if (!wrapperConvo.hidden && !existingConvo.isHidden()) {
        existingConvo.set({ hidden: false });
        changes = true;
      }

      if (Boolean(wrapperConvo.approved) !== Boolean(existingConvo.isApproved())) {
        await existingConvo.setIsApproved(Boolean(wrapperConvo.approved), false);
        changes = true;
      }

      if (Boolean(wrapperConvo.approvedMe) !== Boolean(existingConvo.didApproveMe())) {
        await existingConvo.setDidApproveMe(Boolean(wrapperConvo.approvedMe), false);
        changes = true;
      }

      if (Boolean(wrapperConvo.approvedMe) !== Boolean(existingConvo.didApproveMe())) {
        await existingConvo.setDidApproveMe(Boolean(wrapperConvo.approvedMe), false);
        changes = true;
      }

      //TODO priority means more than just isPinned but has an order logic in it too
      const shouldBePinned = wrapperConvo.priority > 0;
      if (shouldBePinned !== Boolean(existingConvo.isPinned())) {
        await existingConvo.setIsPinned(shouldBePinned, false);
        changes = true;
      }

      const convoBlocked = wrapperConvo.blocked || false;
      await BlockedNumberController.setBlocked(wrapperConvo.id, convoBlocked);

      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await existingConvo.commit();
      }

      // we still need to handle the `name` (synchronous) and the `profilePicture` (asynchronous)
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

async function handleUserGroupsUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  if (!result.needsDump) {
    return result;
  }

  // first let's check which communities needs to be joined or left by doing a diff of what is in the wrapper and what is in the DB
  const allCommunitiesInWrapper = await UserGroupsWrapperActions.getAllCommunities();
  const allCommunitiesConversation = getConversationController()
    .getConversations()
    .filter(SessionUtilUserGroups.filterUserCommunitiesToStoreInWrapper);

  const allCommunitiesIdsInDB = allCommunitiesConversation.map(m => m.id as string);

  const communitiesIdsInWrapper = compact(
    allCommunitiesInWrapper.map(m => {
      try {
        const builtConvoId = OpenGroupUtils.getOpenGroupV2ConversationId(
          m.baseUrl,
          m.roomCasePreserved
        );
        return builtConvoId;
      } catch (e) {
        return null;
      }
    })
  );

  const communitiesToJoinInDB = compact(
    allCommunitiesInWrapper.map(m => {
      try {
        const builtConvoId = OpenGroupUtils.getOpenGroupV2ConversationId(
          m.baseUrl,
          m.roomCasePreserved
        );
        if (allCommunitiesIdsInDB.includes(builtConvoId)) {
          return null;
        }
        console.warn('builtConvoId', builtConvoId, allCommunitiesIdsInDB);
        return m;
      } catch (e) {
        return null;
      }
    })
  );

  const communitiesToLeaveInDB = compact(
    allCommunitiesConversation.map(m => {
      return communitiesIdsInWrapper.includes(m.id) ? null : m;
    })
  );

  console.warn(
    'communitiesToJoinInDB',
    communitiesToJoinInDB.map(m => `${m.fullUrl}`)
  );

  for (let index = 0; index < communitiesToLeaveInDB.length; index++) {
    const toLeave = communitiesToLeaveInDB[index];
    console.warn('leaving community with convoId ', toLeave.id);
    await getConversationController().deleteContact(toLeave.id);
  }

  // this call can take quite a long time and should not cause issues to not be awaited
  void Promise.all(
    communitiesToJoinInDB.map(async toJoin => {
      console.warn('joining community with convoId ', toJoin.fullUrl);
      return getOpenGroupManager().attemptConnectionV2OneAtATime(
        toJoin.baseUrl,
        toJoin.roomCasePreserved,
        toJoin.pubkeyHex
      );
    })
  );

  // if the convos already exists, make sure to update the fields if needed
  for (let index = 0; index < allCommunitiesInWrapper.length; index++) {
    const fromWrapper = allCommunitiesInWrapper[index];
    const convoId = OpenGroupUtils.getOpenGroupV2ConversationId(
      fromWrapper.baseUrl,
      fromWrapper.roomCasePreserved
    );

    const existingConvo = getConversationController().get(convoId);
    if (fromWrapper && existingConvo) {
      let changes = false;

      //TODO priority means more than just isPinned but has an order logic in it too
      const shouldBePinned = fromWrapper.priority > 0;
      if (shouldBePinned !== Boolean(existingConvo.isPinned())) {
        await existingConvo.setIsPinned(shouldBePinned, false);
        changes = true;
      }

      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await existingConvo.commit();
      }
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
      case SignalService.SharedConfigMessage.Kind.USER_GROUPS:
        finalResult = await handleUserGroupsUpdate(incomingResult);
        break;
      default:
        throw new Error(`processMergingResults unknown kind of contact : ${kind}`);
    }
    const variant = LibSessionUtil.kindToVariant(kind);

    if (finalResult.needsDump) {
      // The config data had changes so regenerate the dump and save it

      const dump = await GenericWrapperActions.dump(variant);
      await ConfigDumpData.saveConfigDump({
        data: dump,
        publicKey: pubkey,
        variant,
      });
    }

    await removeFromCache(envelope);
  } catch (e) {
    window.log.error(`processMergingResults failed with ${e.message}`);
    await removeFromCache(envelope);
    return;
  }

  // Now that the local state has been updated, trigger a config sync (this will push any
  // pending updates and properly update the state)
  if (result.result.needsPush) {
    await ConfigurationSync.queueNewJobIfNeeded();
  }
}

async function handleConfigMessageViaLibSession(
  envelope: EnvelopePlus,
  configMessage: IncomingMessage<SignalService.ISharedConfigMessage>
) {
  // TODO: Remove this once `useSharedUtilForUserConfig` is permanent
  if (!window.sessionFeatureFlags.useSharedUtilForUserConfig) {
    await removeFromCache(envelope);
    return;
  }

  if (!configMessage) {
    await removeFromCache(envelope);

    return;
  }

  window?.log?.info('Handling our sharedConfig message via libsession_util.');

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
      await BlockedNumberController.unblockAll([contactConvo.id]);
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
