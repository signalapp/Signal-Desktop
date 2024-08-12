/* eslint-disable no-await-in-loop */
import { ContactInfo } from 'libsession_util_nodejs';
import { compact, difference, isEmpty, isNil, isNumber, toNumber } from 'lodash';
import { ConfigDumpData } from '../data/configDump/configDump';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { ConversationInteraction } from '../interactions';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../interactions/conversationInteractions';
import { SignalService } from '../protobuf';
import { ClosedGroup } from '../session';
import {
  joinOpenGroupV2WithUIEvents,
  parseOpenGroupV2,
} from '../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { getOpenGroupManager } from '../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { getOpenGroupV2ConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { getConversationController } from '../session/conversations';
import { Profile, ProfileManager } from '../session/profile_manager/ProfileManager';
import { PubKey } from '../session/types';
import { StringUtils, UserUtils } from '../session/utils';
import { toHex } from '../session/utils/String';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { FetchMsgExpirySwarm } from '../session/utils/job_runners/jobs/FetchMsgExpirySwarmJob'; // eslint-disable-next-line import/no-unresolved, import/extensions
import { IncomingConfResult, LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { SessionUtilContact } from '../session/utils/libsession/libsession_utils_contacts';
import { SessionUtilConvoInfoVolatile } from '../session/utils/libsession/libsession_utils_convo_info_volatile';
import { SessionUtilUserGroups } from '../session/utils/libsession/libsession_utils_user_groups';
import { configurationMessageReceived, trigger } from '../shims/events';
import { getCurrentlySelectedConversationOutsideRedux } from '../state/selectors/conversations';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { BlockedNumberController } from '../util';
import { Registration } from '../util/registration';
import { ReleasedFeatures } from '../util/releaseFeature';
import { Storage, isSignInByLinking, setLastProfileUpdateTimestamp } from '../util/storage';

import { SnodeNamespaces } from '../session/apis/snode_api/namespaces';
import { RetrieveMessageItemWithNamespace } from '../session/apis/snode_api/types';
// eslint-disable-next-line import/no-unresolved
import { ConfigWrapperObjectTypes } from '../webworker/workers/browser/libsession_worker_functions';
import {
  ContactsWrapperActions,
  ConvoInfoVolatileWrapperActions,
  GenericWrapperActions,
  UserConfigWrapperActions,
  UserGroupsWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { removeFromCache } from './cache';
import { addKeyPairToCacheAndDBIfNeeded } from './closedGroups';
import { HexKeyPair } from './keypairs';
import { queueAllCachedFromSource } from './receiver';
import { EnvelopePlus } from './types';
import { ConversationTypeEnum, CONVERSATION_PRIORITIES } from '../models/types';
import { CONVERSATION } from '../session/constants';

function groupByNamespace(incomingConfigs: Array<RetrieveMessageItemWithNamespace>) {
  const groupedByVariant: Map<
    ConfigWrapperObjectTypes,
    Array<RetrieveMessageItemWithNamespace>
  > = new Map();

  incomingConfigs.forEach(incomingConfig => {
    const { namespace } = incomingConfig;

    const wrapperId: ConfigWrapperObjectTypes | null =
      namespace === SnodeNamespaces.UserProfile
        ? 'UserConfig'
        : namespace === SnodeNamespaces.UserContacts
          ? 'ContactsConfig'
          : namespace === SnodeNamespaces.UserGroups
            ? 'UserGroupsConfig'
            : namespace === SnodeNamespaces.ConvoInfoVolatile
              ? 'ConvoInfoVolatileConfig'
              : null;

    if (!wrapperId) {
      throw new Error('Unexpected wrapperId');
    }

    if (!groupedByVariant.has(wrapperId)) {
      groupedByVariant.set(wrapperId, []);
    }

    groupedByVariant.get(wrapperId)?.push(incomingConfig);
  });
  return groupedByVariant;
}

async function mergeConfigsWithIncomingUpdates(
  incomingConfigs: Array<RetrieveMessageItemWithNamespace>
): Promise<Map<ConfigWrapperObjectTypes, IncomingConfResult>> {
  // first, group by variant so we do a single merge call
  const groupedByNamespace = groupByNamespace(incomingConfigs);

  const groupedResults: Map<ConfigWrapperObjectTypes, IncomingConfResult> = new Map();

  // TODOLATER currently we only poll for user config messages, so this can be hardcoded
  const publicKey = UserUtils.getOurPubKeyStrFromCache();

  try {
    for (let index = 0; index < groupedByNamespace.size; index++) {
      const variant = [...groupedByNamespace.keys()][index];
      const sameVariant = groupedByNamespace.get(variant);
      if (!sameVariant?.length) {
        continue;
      }
      const toMerge = sameVariant.map(msg => ({
        data: StringUtils.fromBase64ToArray(msg.data),
        hash: msg.hash,
      }));
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `printDumpsForDebugging: before merge of ${variant}:`,
          StringUtils.toHex(await GenericWrapperActions.dump(variant))
        );

        for (let dumpIndex = 0; dumpIndex < toMerge.length; dumpIndex++) {
          const element = toMerge[dumpIndex];
          window.log.info(
            `printDumpsForDebugging: toMerge of ${dumpIndex}:${element.hash}:  ${element.data} `,
            StringUtils.toHex(await GenericWrapperActions.dump(variant))
          );
        }
      }

      const hashesMerged = await GenericWrapperActions.merge(variant, toMerge);
      const needsPush = await GenericWrapperActions.needsPush(variant);
      const needsDump = await GenericWrapperActions.needsDump(variant);
      const mergedTimestamps = sameVariant
        .filter(m => hashesMerged.includes(m.hash))
        .map(m => m.timestamp);
      const latestEnvelopeTimestamp = Math.max(...mergedTimestamps);

      window.log.debug(
        `${variant}: "${publicKey}" needsPush:${needsPush} needsDump:${needsDump}; mergedCount:${hashesMerged.length}`
      );

      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `printDumpsForDebugging: after merge of ${variant}:`,
          StringUtils.toHex(await GenericWrapperActions.dump(variant))
        );
      }
      const incomingConfResult: IncomingConfResult = {
        needsDump,
        needsPush,
        kind: LibSessionUtil.variantToKind(variant),
        publicKey,
        latestEnvelopeTimestamp: latestEnvelopeTimestamp || Date.now(),
      };
      groupedResults.set(variant, incomingConfResult);
    }

    return groupedResults;
  } catch (e) {
    window.log.error('mergeConfigsWithIncomingUpdates failed with', e);
    throw e;
  }
}

export function getSettingsKeyFromLibsessionWrapper(
  wrapperType: ConfigWrapperObjectTypes
): string | null {
  switch (wrapperType) {
    case 'UserConfig':
      return SettingsKey.latestUserProfileEnvelopeTimestamp;
    case 'ContactsConfig':
      return SettingsKey.latestUserContactsEnvelopeTimestamp;
    case 'UserGroupsConfig':
      return SettingsKey.latestUserGroupEnvelopeTimestamp;
    case 'ConvoInfoVolatileConfig':
      return null; // we don't really care about the convo info volatile one
    default:
      try {
        assertUnreachable(
          wrapperType,
          `getSettingsKeyFromLibsessionWrapper unknown type: ${wrapperType}`
        );
      } catch (e) {
        window.log.warn('assertUnreachable:', e.message);
      }
      return null;
  }
}

async function updateLibsessionLatestProcessedUserTimestamp(
  wrapperType: ConfigWrapperObjectTypes,
  latestEnvelopeTimestamp: number
) {
  const settingsKey = getSettingsKeyFromLibsessionWrapper(wrapperType);
  if (!settingsKey) {
    return;
  }
  const currentLatestEnvelopeProcessed = Storage.get(settingsKey) || 0;

  const newLatestProcessed = Math.max(
    latestEnvelopeTimestamp,
    isNumber(currentLatestEnvelopeProcessed) ? currentLatestEnvelopeProcessed : 0
  );
  if (newLatestProcessed !== currentLatestEnvelopeProcessed || currentLatestEnvelopeProcessed) {
    await Storage.put(settingsKey, newLatestProcessed);
  }
}

/**
 * NOTE When adding new properties to the wrapper, don't update the conversation model here because the merge has not been done yet.
 * Instead you will need to updateOurProfileLegacyOrViaLibSession() to support them
 */
async function handleUserProfileUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  const updateUserInfo = await UserConfigWrapperActions.getUserInfo();
  if (!updateUserInfo) {
    return result;
  }

  const currentBlindedMsgRequest = Storage.get(SettingsKey.hasBlindedMsgRequestsEnabled);
  const newBlindedMsgRequest = await UserConfigWrapperActions.getEnableBlindedMsgRequest();
  if (!isNil(newBlindedMsgRequest) && newBlindedMsgRequest !== currentBlindedMsgRequest) {
    await window.setSettingValue(SettingsKey.hasBlindedMsgRequestsEnabled, newBlindedMsgRequest); // this does the dispatch to redux
  }

  const picUpdate = !isEmpty(updateUserInfo.key) && !isEmpty(updateUserInfo.url);

  // NOTE: if you do any changes to the user's settings which are synced, it should be done above the `updateOurProfileLegacyOrViaLibSession` call
  await updateOurProfileLegacyOrViaLibSession({
    sentAt: result.latestEnvelopeTimestamp,
    displayName: updateUserInfo.name,
    profileUrl: picUpdate ? updateUserInfo.url : null,
    profileKey: picUpdate ? updateUserInfo.key : null,
    priority: updateUserInfo.priority,
  });

  // NOTE: If we want to update the conversation in memory with changes from the updated user profile we need to wait untl the profile has been updated to prevent multiple merge conflicts
  const ourConvo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());

  if (ourConvo) {
    let changes = false;

    const expireTimer = ourConvo.getExpireTimer();

    const wrapperNoteToSelfExpirySeconds = await UserConfigWrapperActions.getNoteToSelfExpiry();

    if (wrapperNoteToSelfExpirySeconds !== expireTimer) {
      // TODO legacy messages support will be removed in a future release
      const success = await ourConvo.updateExpireTimer({
        providedDisappearingMode:
          wrapperNoteToSelfExpirySeconds && wrapperNoteToSelfExpirySeconds > 0
            ? ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()
              ? 'deleteAfterSend'
              : 'legacy'
            : 'off',
        providedExpireTimer: wrapperNoteToSelfExpirySeconds,
        providedSource: ourConvo.id,
        receivedAt: result.latestEnvelopeTimestamp,
        fromSync: true,
        shouldCommitConvo: false,
        fromCurrentDevice: false,
        fromConfigMessage: true,
      });
      changes = success;
    }

    // make sure to write the changes to the database now as the `AvatarDownloadJob` triggered by updateOurProfileLegacyOrViaLibSession might take some time before getting run
    if (changes) {
      await ourConvo.commit();
    }
  }

  const settingsKey = SettingsKey.latestUserProfileEnvelopeTimestamp;
  const currentLatestEnvelopeProcessed = Storage.get(settingsKey) || 0;

  const newLatestProcessed = Math.max(
    result.latestEnvelopeTimestamp,
    isNumber(currentLatestEnvelopeProcessed) ? currentLatestEnvelopeProcessed : 0
  );
  if (newLatestProcessed !== currentLatestEnvelopeProcessed) {
    await Storage.put(settingsKey, newLatestProcessed);
  }

  return result;
}

function getContactsToRemoveFromDB(contactsInWrapper: Array<ContactInfo>) {
  const allContactsInDBWhichShouldBeInWrapperIds = getConversationController()
    .getConversations()
    .filter(SessionUtilContact.isContactToStoreInWrapper)
    .map(m => m.id as string);

  const currentlySelectedConversationId = getCurrentlySelectedConversationOutsideRedux();
  const currentlySelectedConvo = currentlySelectedConversationId
    ? getConversationController().get(currentlySelectedConversationId)
    : undefined;

  // we might have some contacts not in the wrapper anymore, so let's clean things up.

  const convoIdsInDbButNotWrapper = difference(
    allContactsInDBWhichShouldBeInWrapperIds,
    contactsInWrapper.map(m => m.id)
  );

  // When starting a conversation with a new user, it is not in the wrapper yet, only when we send the first message.
  // We do not want to forcefully remove that contact as the user might be typing a message to him.
  // So let's check if that currently selected conversation should be forcefully closed or not
  if (
    currentlySelectedConversationId &&
    currentlySelectedConvo &&
    convoIdsInDbButNotWrapper.includes(currentlySelectedConversationId)
  ) {
    if (
      currentlySelectedConvo.isPrivate() &&
      !currentlySelectedConvo.isApproved() &&
      !currentlySelectedConvo.didApproveMe()
    ) {
      const foundIndex = convoIdsInDbButNotWrapper.findIndex(
        m => m === currentlySelectedConversationId
      );
      if (foundIndex !== -1) {
        convoIdsInDbButNotWrapper.splice(foundIndex, 1);
      }
    }
  }
  return convoIdsInDbButNotWrapper;
}

async function deleteContactsFromDB(contactsToRemove: Array<string>) {
  window.log.debug('contacts to fully remove after wrapper merge', contactsToRemove);
  for (let index = 0; index < contactsToRemove.length; index++) {
    const contactToRemove = contactsToRemove[index];
    try {
      await getConversationController().delete1o1(contactToRemove, {
        fromSyncMessage: true,
        justHidePrivate: false,
      });
    } catch (e) {
      window.log.warn(
        `after merge: deleteContactsFromDB ${contactToRemove} failed with `,
        e.message
      );
    }
  }
}

async function handleContactsUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  const us = UserUtils.getOurPubKeyStrFromCache();

  const allContactsInWrapper = await ContactsWrapperActions.getAll();
  const contactsToRemoveFromDB = getContactsToRemoveFromDB(allContactsInWrapper);
  await deleteContactsFromDB(contactsToRemoveFromDB);

  // create new contact conversation here, and update their state with what is part of the wrapper
  for (let index = 0; index < allContactsInWrapper.length; index++) {
    const wrapperConvo = allContactsInWrapper[index];

    if (wrapperConvo.id === us) {
      // our profile update comes from our userProfile, not from the contacts wrapper.
      continue;
    }
    const contactConvo = await getConversationController().getOrCreateAndWait(
      wrapperConvo.id,
      ConversationTypeEnum.PRIVATE
    );
    if (wrapperConvo.id && contactConvo) {
      let changes = false;

      // the display name set is handled in `updateProfileOfContact`
      if (wrapperConvo.nickname !== contactConvo.getNickname()) {
        await contactConvo.setNickname(wrapperConvo.nickname || null, false);
        changes = true;
      }

      const currentPriority = contactConvo.get('priority');
      if (wrapperConvo.priority !== currentPriority) {
        if (wrapperConvo.priority === CONVERSATION_PRIORITIES.hidden) {
          window.log.info(
            'contact marked as hidden and was not before. Deleting all messages from that user'
          );
          await deleteAllMessagesByConvoIdNoConfirmation(wrapperConvo.id);
        }
        await contactConvo.setPriorityFromWrapper(wrapperConvo.priority);
        changes = true;
      }

      if (Boolean(wrapperConvo.approved) !== contactConvo.isApproved()) {
        await contactConvo.setIsApproved(Boolean(wrapperConvo.approved), false);
        changes = true;
      }

      if (Boolean(wrapperConvo.approvedMe) !== contactConvo.didApproveMe()) {
        await contactConvo.setDidApproveMe(Boolean(wrapperConvo.approvedMe), false);
        changes = true;
      }

      if (
        wrapperConvo.expirationTimerSeconds !== contactConvo.getExpireTimer() ||
        wrapperConvo.expirationMode !== contactConvo.getExpirationMode()
      ) {
        const success = await contactConvo.updateExpireTimer({
          providedDisappearingMode: wrapperConvo.expirationMode,
          providedExpireTimer: wrapperConvo.expirationTimerSeconds,
          providedSource: wrapperConvo.id,
          receivedAt: result.latestEnvelopeTimestamp,
          fromSync: true,
          fromCurrentDevice: false,
          shouldCommitConvo: false,
          fromConfigMessage: true,
        });
        changes = changes || success;
      }

      // we want to set the active_at to the created_at timestamp if active_at is unset, so that it shows up in our list.
      if (!contactConvo.get('active_at') && wrapperConvo.createdAtSeconds) {
        contactConvo.set({ active_at: wrapperConvo.createdAtSeconds * 1000 });
        changes = true;
      }

      const convoBlocked = wrapperConvo.blocked || false;
      await BlockedNumberController.setBlocked(wrapperConvo.id, convoBlocked);

      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await contactConvo.commit();
      }

      // we still need to handle the `name` (synchronous) and the `profilePicture` (asynchronous)
      await ProfileManager.updateProfileOfContact(
        contactConvo.id,
        wrapperConvo.name,
        wrapperConvo.profilePicture?.url || null,
        wrapperConvo.profilePicture?.key || null
      );
    }
  }
  return result;
}

async function handleCommunitiesUpdate() {
  // first let's check which communities needs to be joined or left by doing a diff of what is in the wrapper and what is in the DB

  const allCommunitiesInWrapper = await UserGroupsWrapperActions.getAllCommunities();
  window.log.debug(
    'allCommunitiesInWrapper',
    allCommunitiesInWrapper.map(m => m.fullUrlWithPubkey)
  );
  const allCommunitiesConversation = getConversationController()
    .getConversations()
    .filter(SessionUtilUserGroups.isCommunityToStoreInWrapper);

  const allCommunitiesIdsInDB = allCommunitiesConversation.map(m => m.id as string);
  window.log.debug('allCommunitiesIdsInDB', allCommunitiesIdsInDB);

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
        return allCommunitiesIdsInDB.includes(builtConvoId) ? null : m;
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

  for (let index = 0; index < communitiesToLeaveInDB.length; index++) {
    const toLeave = communitiesToLeaveInDB[index];
    window.log.info('leaving community with convoId ', toLeave.id);
    await getConversationController().deleteCommunity(toLeave.id, {
      fromSyncMessage: true,
    });
  }

  // this call can take quite a long time but must be awaited (as it is async and create the entry in the DB, used as a diff)
  try {
    await Promise.all(
      communitiesToJoinInDB.map(async toJoin => {
        window.log.info('joining community with convoId ', toJoin.fullUrlWithPubkey);
        return getOpenGroupManager().attemptConnectionV2OneAtATime(
          toJoin.baseUrl,
          toJoin.roomCasePreserved,
          toJoin.pubkeyHex
        );
      })
    );
  } catch (e) {
    window.log.warn(
      `joining community with failed with one of ${communitiesToJoinInDB}`,
      e.message
    );
  }

  // if the convos already exists, make sure to update the fields if needed
  for (let index = 0; index < allCommunitiesInWrapper.length; index++) {
    const fromWrapper = allCommunitiesInWrapper[index];
    const convoId = OpenGroupUtils.getOpenGroupV2ConversationId(
      fromWrapper.baseUrl,
      fromWrapper.roomCasePreserved
    );

    const communityConvo = getConversationController().get(convoId);
    if (fromWrapper && communityConvo) {
      let changes = false;

      changes =
        (await communityConvo.setPriorityFromWrapper(fromWrapper.priority, false)) || changes;

      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await communityConvo.commit();
      }
    }
  }
}

async function handleLegacyGroupUpdate(latestEnvelopeTimestamp: number) {
  // first let's check which closed groups needs to be joined or left by doing a diff of what is in the wrapper and what is in the DB
  const allLegacyGroupsInWrapper = await UserGroupsWrapperActions.getAllLegacyGroups();
  const allLegacyGroupsInDb = getConversationController()
    .getConversations()
    .filter(SessionUtilUserGroups.isLegacyGroupToRemoveFromDBIfNotInWrapper);

  const allLegacyGroupsIdsInDB = allLegacyGroupsInDb.map(m => m.id as string);
  const allLegacyGroupsIdsInWrapper = allLegacyGroupsInWrapper.map(m => m.pubkeyHex);

  const legacyGroupsToJoinInDB = allLegacyGroupsInWrapper.filter(m => {
    return !allLegacyGroupsIdsInDB.includes(m.pubkeyHex);
  });

  window.log.debug(`allLegacyGroupsInWrapper: ${allLegacyGroupsInWrapper.map(m => m.pubkeyHex)} `);
  window.log.debug(`allLegacyGroupsIdsInDB: ${allLegacyGroupsIdsInDB} `);

  const legacyGroupsToLeaveInDB = allLegacyGroupsInDb.filter(m => {
    return !allLegacyGroupsIdsInWrapper.includes(m.id);
  });
  window.log.info(
    `we have to join ${legacyGroupsToJoinInDB.length} legacy groups in DB compared to what is in the wrapper`
  );

  window.log.info(
    `we have to leave ${legacyGroupsToLeaveInDB.length} legacy groups in DB compared to what is in the wrapper`
  );

  for (let index = 0; index < legacyGroupsToLeaveInDB.length; index++) {
    const toLeave = legacyGroupsToLeaveInDB[index];
    window.log.info(
      'leaving legacy group from configuration sync message with convoId ',
      toLeave.id
    );
    const toLeaveFromDb = getConversationController().get(toLeave.id);
    // the wrapper told us that this group is not tracked, so even if we left/got kicked from it, remove it from the DB completely
    await getConversationController().deleteClosedGroup(toLeaveFromDb.id, {
      fromSyncMessage: true,
      sendLeaveMessage: false, // this comes from the wrapper, so we must have left/got kicked from that group already and our device already handled it.
    });
  }

  for (let index = 0; index < legacyGroupsToJoinInDB.length; index++) {
    const toJoin = legacyGroupsToJoinInDB[index];
    window.log.info(
      'joining legacy group from configuration sync message with convoId ',
      toJoin.pubkeyHex
    );

    // let's just create the required convo here, as we update the fields right below
    await getConversationController().getOrCreateAndWait(
      toJoin.pubkeyHex,
      ConversationTypeEnum.GROUP
    );
  }

  for (let index = 0; index < allLegacyGroupsInWrapper.length; index++) {
    const fromWrapper = allLegacyGroupsInWrapper[index];

    const legacyGroupConvo = getConversationController().get(fromWrapper.pubkeyHex);
    if (!legacyGroupConvo) {
      // this should not happen as we made sure to create them before
      window.log.warn(
        'could not find legacy group which should already be there:',
        fromWrapper.pubkeyHex
      );
      continue;
    }

    const members = fromWrapper.members.map(m => m.pubkeyHex);
    const admins = fromWrapper.members.filter(m => m.isAdmin).map(m => m.pubkeyHex);

    const creationTimestamp = fromWrapper.joinedAtSeconds
      ? fromWrapper.joinedAtSeconds * 1000
      : CONVERSATION.LAST_JOINED_FALLBACK_TIMESTAMP;

    // then for all the existing legacy group in the wrapper, we need to override the field of what we have in the DB with what is in the wrapper
    // We only set group admins on group creation
    const groupDetails: ClosedGroup.GroupInfo = {
      id: fromWrapper.pubkeyHex,
      name: fromWrapper.name,
      members,
      admins,
      activeAt:
        !!legacyGroupConvo.get('active_at') && legacyGroupConvo.get('active_at') > creationTimestamp
          ? legacyGroupConvo.get('active_at')
          : creationTimestamp,
    };

    await ClosedGroup.updateOrCreateClosedGroup(groupDetails);

    let changes = await legacyGroupConvo.setPriorityFromWrapper(fromWrapper.priority, false);

    if (fromWrapper.disappearingTimerSeconds !== legacyGroupConvo.getExpireTimer()) {
      // TODO legacy messages support will be removed in a future release
      const success = await legacyGroupConvo.updateExpireTimer({
        providedDisappearingMode:
          fromWrapper.disappearingTimerSeconds && fromWrapper.disappearingTimerSeconds > 0
            ? ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()
              ? 'deleteAfterSend'
              : 'legacy'
            : 'off',
        providedExpireTimer: fromWrapper.disappearingTimerSeconds,
        providedSource: legacyGroupConvo.id,
        receivedAt: latestEnvelopeTimestamp,
        fromSync: true,
        shouldCommitConvo: false,
        fromCurrentDevice: false,
        fromConfigMessage: true,
      });
      changes = success;
    }

    const existingTimestampMs = legacyGroupConvo.get('lastJoinedTimestamp');
    const existingJoinedAtSeconds = Math.floor(existingTimestampMs / 1000);
    if (existingJoinedAtSeconds !== creationTimestamp) {
      legacyGroupConvo.set({
        lastJoinedTimestamp: creationTimestamp,
      });
      changes = true;
    }
    // start polling for this group if we haven't left it yet. The wrapper does not store this info for legacy group so we check from the DB entry instead
    if (!legacyGroupConvo.get('isKickedFromGroup') && !legacyGroupConvo.get('left')) {
      getSwarmPollingInstance().addGroupId(PubKey.cast(fromWrapper.pubkeyHex));

      // save the encryption keypair if needed
      if (!isEmpty(fromWrapper.encPubkey) && !isEmpty(fromWrapper.encSeckey)) {
        try {
          const inWrapperKeypair: HexKeyPair = {
            publicHex: toHex(fromWrapper.encPubkey),
            privateHex: toHex(fromWrapper.encSeckey),
          };

          await addKeyPairToCacheAndDBIfNeeded(fromWrapper.pubkeyHex, inWrapperKeypair);
        } catch (e) {
          window.log.warn('failed to save keypair for legacugroup', fromWrapper.pubkeyHex);
        }
      }
    }

    if (changes) {
      // this commit will grab the latest encryption keypair and add it to the user group wrapper if needed
      await legacyGroupConvo.commit();
    }

    // trigger decrypting of all this group messages we did not decrypt successfully yet.
    await queueAllCachedFromSource(fromWrapper.pubkeyHex);
  }
}

async function handleUserGroupsUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  const toHandle = SessionUtilUserGroups.getUserGroupTypes();
  for (let index = 0; index < toHandle.length; index++) {
    const typeToHandle = toHandle[index];
    switch (typeToHandle) {
      case 'Community':
        await handleCommunitiesUpdate();
        break;
      case 'LegacyGroup':
        await handleLegacyGroupUpdate(result.latestEnvelopeTimestamp);
        break;

      default:
        assertUnreachable(typeToHandle, `handleUserGroupsUpdate unhandled type "${typeToHandle}"`);
    }
  }

  return result;
}

async function applyConvoVolatileUpdateFromWrapper(
  convoId: string,
  forcedUnread: boolean,
  lastReadMessageTimestamp: number
) {
  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo) {
    return;
  }

  try {
    // TODO legacy messages support will be removed in a future release
    if (foundConvo.isPrivate() && !foundConvo.isMe() && foundConvo.getExpireTimer() > 0) {
      const messagesExpiring = await Data.getUnreadDisappearingByConversation(
        convoId,
        lastReadMessageTimestamp
      );

      const messagesExpiringAfterRead = messagesExpiring.filter(
        m => m.getExpirationType() === 'deleteAfterRead' && m.getExpireTimerSeconds() > 0
      );

      const messageIdsToFetchExpiriesFor = compact(messagesExpiringAfterRead.map(m => m.id));

      if (messageIdsToFetchExpiriesFor.length) {
        await FetchMsgExpirySwarm.queueNewJobIfNeeded(messageIdsToFetchExpiriesFor);
      }
    }

    // this mark all the messages sent before fromWrapper.lastRead as read and update the unreadCount
    await foundConvo.markReadFromConfigMessage(lastReadMessageTimestamp);
    // this commits to the DB, if needed
    await foundConvo.markAsUnread(forcedUnread, true);

    if (SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(foundConvo)) {
      await SessionUtilConvoInfoVolatile.refreshConvoVolatileCached(
        foundConvo.id,
        foundConvo.isClosedGroup(),
        false
      );

      await foundConvo.refreshInMemoryDetails();
    }
  } catch (e) {
    window.log.warn(
      `applyConvoVolatileUpdateFromWrapper of "${convoId}" failed with error ${e.message}`
    );
  }
}

async function handleConvoInfoVolatileUpdate(
  result: IncomingConfResult
): Promise<IncomingConfResult> {
  const types = SessionUtilConvoInfoVolatile.getConvoInfoVolatileTypes();
  for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
    const type = types[typeIndex];
    switch (type) {
      case '1o1':
        try {
          // Note: "Note to Self" comes here too
          const wrapper1o1s = await ConvoInfoVolatileWrapperActions.getAll1o1();
          for (let index = 0; index < wrapper1o1s.length; index++) {
            const fromWrapper = wrapper1o1s[index];

            await applyConvoVolatileUpdateFromWrapper(
              fromWrapper.pubkeyHex,
              fromWrapper.unread,
              fromWrapper.lastRead
            );
          }
        } catch (e) {
          window.log.warn('handleConvoInfoVolatileUpdate of "1o1" failed with error: ', e.message);
        }

        break;
      case 'Community':
        try {
          const wrapperComms = await ConvoInfoVolatileWrapperActions.getAllCommunities();
          for (let index = 0; index < wrapperComms.length; index++) {
            const fromWrapper = wrapperComms[index];

            const convoId = getOpenGroupV2ConversationId(
              fromWrapper.baseUrl,
              fromWrapper.roomCasePreserved
            );

            await applyConvoVolatileUpdateFromWrapper(
              convoId,
              fromWrapper.unread,
              fromWrapper.lastRead
            );
          }
        } catch (e) {
          window.log.warn(
            'handleConvoInfoVolatileUpdate of "Community" failed with error: ',
            e.message
          );
        }
        break;

      case 'LegacyGroup':
        try {
          const legacyGroups = await ConvoInfoVolatileWrapperActions.getAllLegacyGroups();
          for (let index = 0; index < legacyGroups.length; index++) {
            const fromWrapper = legacyGroups[index];

            await applyConvoVolatileUpdateFromWrapper(
              fromWrapper.pubkeyHex,
              fromWrapper.unread,
              fromWrapper.lastRead
            );
          }
        } catch (e) {
          window.log.warn(
            'handleConvoInfoVolatileUpdate of "LegacyGroup" failed with error: ',
            e.message
          );
        }
        break;

      default:
        assertUnreachable(type, `handleConvoInfoVolatileUpdate: unhandeld switch case: ${type}`);
    }
  }

  return result;
}

async function processMergingResults(results: Map<ConfigWrapperObjectTypes, IncomingConfResult>) {
  if (!results || !results.size) {
    return;
  }

  const keys = [...results.keys()];
  let anyNeedsPush = false;
  for (let index = 0; index < keys.length; index++) {
    const wrapperType = keys[index];
    const incomingResult = results.get(wrapperType);
    if (!incomingResult) {
      continue;
    }

    try {
      const { kind } = incomingResult;
      switch (kind) {
        case SignalService.SharedConfigMessage.Kind.USER_PROFILE:
          await handleUserProfileUpdate(incomingResult);
          break;
        case SignalService.SharedConfigMessage.Kind.CONTACTS:
          await handleContactsUpdate(incomingResult);
          break;
        case SignalService.SharedConfigMessage.Kind.USER_GROUPS:
          await handleUserGroupsUpdate(incomingResult);
          break;
        case SignalService.SharedConfigMessage.Kind.CONVO_INFO_VOLATILE:
          await handleConvoInfoVolatileUpdate(incomingResult);
          break;
        default:
          try {
            // we catch errors here because an old client knowing about a new type of config coming from the network should not just crash
            assertUnreachable(kind, `processMergingResults unsupported kind: "${kind}"`);
          } catch (e) {
            window.log.warn('assertUnreachable failed', e.message);
          }
      }

      const variant = LibSessionUtil.kindToVariant(kind);
      try {
        await updateLibsessionLatestProcessedUserTimestamp(
          variant,
          incomingResult.latestEnvelopeTimestamp
        );
      } catch (e) {
        window.log.error(`updateLibsessionLatestProcessedUserTimestamp failed with "${e.message}"`);
      }

      if (incomingResult.needsDump) {
        // The config data had changes so regenerate the dump and save it

        const dump = await GenericWrapperActions.dump(variant);
        await ConfigDumpData.saveConfigDump({
          data: dump,
          publicKey: incomingResult.publicKey,
          variant,
        });
      }

      if (incomingResult.needsPush) {
        anyNeedsPush = true;
      }
    } catch (e) {
      window.log.error(`processMergingResults failed with ${e.message}`);
      return;
    }
  }
  // Now that the local state has been updated, trigger a config sync (this will push any
  // pending updates and properly update the state)
  if (anyNeedsPush) {
    await ConfigurationSync.queueNewJobIfNeeded();
  }
}

async function handleConfigMessagesViaLibSession(
  configMessages: Array<RetrieveMessageItemWithNamespace>
) {
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

  if (!userConfigLibsession) {
    return;
  }

  if (isEmpty(configMessages)) {
    return;
  }

  window?.log?.debug(
    `Handling our sharedConfig message via libsession_util ${JSON.stringify(
      configMessages.map(m => ({
        namespace: m.namespace,
        hash: m.hash,
      }))
    )}`
  );

  const incomingMergeResult = await mergeConfigsWithIncomingUpdates(configMessages);

  await processMergingResults(incomingMergeResult);
}

async function updateOurProfileLegacyOrViaLibSession({
  sentAt,
  displayName,
  profileUrl,
  profileKey,
  priority,
}: Profile & { sentAt: number }) {
  await ProfileManager.updateOurProfileSync({
    displayName,
    profileUrl,
    profileKey,
    priority,
  });

  await setLastProfileUpdateTimestamp(toNumber(sentAt));
  // do not trigger a signin by linking if the display name is empty
  if (!isEmpty(displayName)) {
    trigger(configurationMessageReceived, displayName);
  } else {
    window?.log?.warn('Got a configuration message but the display name is empty');
  }
}

async function handleGroupsAndContactsFromConfigMessageLegacy(
  envelope: EnvelopePlus,
  configMessage: SignalService.ConfigurationMessage
) {
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

  if (userConfigLibsession && Registration.isDone()) {
    return;
  }
  const envelopeTimestamp = toNumber(envelope.timestamp);

  // at some point, we made the hasSyncedInitialConfigurationItem item to have a value=true and a timestamp set.
  // we can actually just use the timestamp as a boolean, as if it is set, we know we have synced the initial config
  // but we still need to handle the case where the timestamp was set when the value is true (for backwards compatiblity, until we get rid of the config message legacy)
  const lastConfigUpdate = await Data.getItemById(SettingsKey.hasSyncedInitialConfigurationItem);

  let lastConfigTimestamp: number | undefined;
  if (isNumber(lastConfigUpdate?.value)) {
    lastConfigTimestamp = lastConfigUpdate?.value;
  } else if (isNumber((lastConfigUpdate as any)?.timestamp)) {
    lastConfigTimestamp = (lastConfigUpdate as any)?.timestamp; // ugly, but we can remove it once we dropped support for legacy config message, see comment above
  }

  const isNewerConfig =
    !lastConfigTimestamp || (lastConfigTimestamp && lastConfigTimestamp < envelopeTimestamp);

  if (!isNewerConfig) {
    window?.log?.info('Received outdated configuration message... Dropping message.');
    return;
  }

  await Storage.put(SettingsKey.hasSyncedInitialConfigurationItem, envelopeTimestamp);

  void handleOpenGroupsFromConfigLegacy(configMessage.openGroups);

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
const handleOpenGroupsFromConfigLegacy = async (openGroups: Array<string>) => {
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

  if (userConfigLibsession && Registration.isDone()) {
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
 * Handles adding of a contact and setting approval/block status
 * @param contactReceived Contact to sync
 */
const handleContactFromConfigLegacy = async (
  contactReceived: SignalService.ConfigurationMessage.IContact,
  envelope: EnvelopePlus
) => {
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

  if (userConfigLibsession && Registration.isDone()) {
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
      contactConvo.set('active_at', toNumber(envelope.timestamp));
    }

    // checking for existence of field on protobuf
    if (contactReceived.isApproved === true) {
      if (!contactConvo.isApproved()) {
        await contactConvo.setIsApproved(Boolean(contactReceived.isApproved));
        await contactConvo.addOutgoingApprovalMessage(toNumber(envelope.timestamp));
      }

      if (contactReceived.didApproveMe === true) {
        // checking for existence of field on message
        await contactConvo.setDidApproveMe(Boolean(contactReceived.didApproveMe));
      }
    }

    // only set for explicit true/false values in case outdated sender doesn't have the fields
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
  // when the useSharedUtilForUserConfig flag is ON, we want only allow a legacy config message if we are registering a new user.
  // this is to allow users linking a device to find their config message if they do not have a shared config message yet.
  // the process of those messages is always done after the process of the shared config messages, so that's only a fallback.
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

  if (userConfigLibsession && !isSignInByLinking()) {
    window?.log?.info(
      'useSharedUtilForUserConfig is set, not handling config messages with "handleConfigurationMessageLegacy()"'
    );
    await window.setSettingValue(SettingsKey.someDeviceOutdatedSyncing, true);
    await removeFromCache(envelope);
    return;
  }

  window?.log?.info('Handling legacy configuration message');
  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubkey) {
    return;
  }

  if (envelope.source !== ourPubkey) {
    window?.log?.info('Dropping configuration change from someone else than us.');
    await removeFromCache(envelope);
    return;
  }

  await handleGroupsAndContactsFromConfigMessageLegacy(envelope, configurationMessage);
  await removeFromCache(envelope);
}

export const ConfigMessageHandler = {
  handleConfigurationMessageLegacy,
  handleConfigMessagesViaLibSession,
};
