import { ContactInfo } from 'libsession_util_nodejs';
import { compact, difference, isEmpty, isNumber, toNumber } from 'lodash';
import { ConfigDumpData } from '../data/configDump/configDump';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { ConversationInteraction } from '../interactions';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../models/conversationAttributes';
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
import { IncomingMessage } from '../session/messages/incoming/IncomingMessage';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { PubKey } from '../session/types';
import { StringUtils, UserUtils } from '../session/utils';
import { toHex } from '../session/utils/String';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
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
import {
  Storage,
  getLastProfileUpdateTimestamp,
  isSignInByLinking,
  setLastProfileUpdateTimestamp,
} from '../util/storage';
import { ConfigWrapperObjectTypes } from '../webworker/workers/browser/libsession_worker_functions';
import {
  ContactsWrapperActions,
  ConvoInfoVolatileWrapperActions,
  GenericWrapperActions,
  UserConfigWrapperActions,
  UserGroupsWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { removeFromCache } from './cache';
import { addKeyPairToCacheAndDBIfNeeded, handleNewClosedGroup } from './closedGroups';
import { HexKeyPair } from './keypairs';
import { queueAllCachedFromSource } from './receiver';
import { EnvelopePlus } from './types';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../interactions/conversationInteractions';

const printDumpsForDebugging = false;

function groupByVariant(
  incomingConfigs: Array<IncomingMessage<SignalService.ISharedConfigMessage>>
) {
  const groupedByVariant: Map<
    ConfigWrapperObjectTypes,
    Array<IncomingMessage<SignalService.ISharedConfigMessage>>
  > = new Map();

  incomingConfigs.forEach(incomingConfig => {
    const { kind } = incomingConfig.message;

    const wrapperId = LibSessionUtil.kindToVariant(kind);

    if (!groupedByVariant.has(wrapperId)) {
      groupedByVariant.set(wrapperId, []);
    }

    groupedByVariant.get(wrapperId)?.push(incomingConfig);
  });
  return groupedByVariant;
}

async function mergeConfigsWithIncomingUpdates(
  incomingConfigs: Array<IncomingMessage<SignalService.ISharedConfigMessage>>
): Promise<Map<ConfigWrapperObjectTypes, IncomingConfResult>> {
  // first, group by variant so we do a single merge call
  const groupedByVariant = groupByVariant(incomingConfigs);

  const groupedResults: Map<ConfigWrapperObjectTypes, IncomingConfResult> = new Map();

  // TODOLATER currently we only poll for user config messages, so this can be hardcoded
  const publicKey = UserUtils.getOurPubKeyStrFromCache();

  try {
    for (let index = 0; index < groupedByVariant.size; index++) {
      const variant = [...groupedByVariant.keys()][index];
      const sameVariant = groupedByVariant.get(variant);
      if (!sameVariant?.length) {
        continue;
      }
      const toMerge = sameVariant.map(msg => ({
        data: msg.message.data,
        hash: msg.messageHash,
      }));
      if (printDumpsForDebugging) {
        window.log.info(
          `printDumpsForDebugging: before merge of ${variant}:`,
          StringUtils.toHex(await GenericWrapperActions.dump(variant))
        );

        for (let index = 0; index < toMerge.length; index++) {
          const element = toMerge[index];
          window.log.info(
            `printDumpsForDebugging: toMerge of ${index}:${element.hash}:  ${StringUtils.toHex(
              element.data
            )} `,
            StringUtils.toHex(await GenericWrapperActions.dump(variant))
          );
        }
      }

      const mergedCount = await GenericWrapperActions.merge(variant, toMerge);
      const needsPush = await GenericWrapperActions.needsPush(variant);
      const needsDump = await GenericWrapperActions.needsDump(variant);
      const latestEnvelopeTimestamp = Math.max(...sameVariant.map(m => m.envelopeTimestamp));

      window.log.debug(
        `${variant}: "${publicKey}" needsPush:${needsPush} needsDump:${needsDump}; mergedCount:${mergedCount} `
      );

      if (printDumpsForDebugging) {
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
        latestEnvelopeTimestamp: latestEnvelopeTimestamp ? latestEnvelopeTimestamp : Date.now(),
      };
      groupedResults.set(variant, incomingConfResult);
    }

    return groupedResults;
  } catch (e) {
    window.log.error('mergeConfigsWithIncomingUpdates failed with', e);
    throw e;
  }
}

async function handleUserProfileUpdate(result: IncomingConfResult): Promise<IncomingConfResult> {
  const updateUserInfo = await UserConfigWrapperActions.getUserInfo();
  if (!updateUserInfo) {
    return result;
  }
  const picUpdate = !isEmpty(updateUserInfo.key) && !isEmpty(updateUserInfo.url);

  await updateOurProfileLegacyOrViaLibSession(
    result.latestEnvelopeTimestamp,
    updateUserInfo.name,
    picUpdate ? updateUserInfo.url : null,
    picUpdate ? updateUserInfo.key : null,
    updateUserInfo.priority
  );

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
      await getConversationController().deleteContact(contactToRemove, {
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

// tslint:disable-next-line: cyclomatic-complexity
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

      if (wrapperConvo.expirationTimerSeconds !== contactConvo.get('expireTimer')) {
        await contactConvo.updateExpireTimer(wrapperConvo.expirationTimerSeconds);
        changes = true;
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
    await getConversationController().deleteContact(toLeave.id, {
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

    // if we were kicked from that group, leave it as is until the user manually deletes it
    // otherwise, completely remove the conversation
    if (!toLeaveFromDb?.get('isKickedFromGroup')) {
      window.log.debug(`we were kicked from ${toLeave.id} so we keep it until manually deleted`);

      await getConversationController().deleteContact(toLeave.id, {
        fromSyncMessage: true,
      });
    }
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
    // then for all the existing legacy group in the wrapper, we need to override the field of what we have in the DB with what is in the wrapper
    // We only set group admins on group creation
    const groupDetails: ClosedGroup.GroupInfo = {
      id: fromWrapper.pubkeyHex,
      name: fromWrapper.name,
      members,
      admins,
      activeAt:
        !!legacyGroupConvo.get('active_at') &&
        legacyGroupConvo.get('active_at') < latestEnvelopeTimestamp
          ? legacyGroupConvo.get('active_at')
          : latestEnvelopeTimestamp,
    };

    await ClosedGroup.updateOrCreateClosedGroup(groupDetails);

    let changes = await legacyGroupConvo.setPriorityFromWrapper(fromWrapper.priority, false);

    const existingTimestampMs = legacyGroupConvo.get('lastJoinedTimestamp');
    const existingJoinedAtSeconds = Math.floor(existingTimestampMs / 1000);
    if (existingJoinedAtSeconds !== fromWrapper.joinedAtSeconds) {
      legacyGroupConvo.set({
        lastJoinedTimestamp: fromWrapper.joinedAtSeconds * 1000,
      });
      changes = true;
    }

    if (legacyGroupConvo.get('expireTimer') !== fromWrapper.disappearingTimerSeconds) {
      await legacyGroupConvo.updateExpireTimer(
        fromWrapper.disappearingTimerSeconds,
        undefined,
        latestEnvelopeTimestamp,
        {
          fromSync: true,
        }
      );
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
    // window.log.debug(
    //   `applyConvoVolatileUpdateFromWrapper: ${convoId}: forcedUnread:${forcedUnread}, lastReadMessage:${lastReadMessageTimestamp}`
    // );
    // this should mark all the messages sent before fromWrapper.lastRead as read and update the unreadCount
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
  configMessages: Array<IncomingMessage<SignalService.ISharedConfigMessage>>
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
        variant: LibSessionUtil.kindToVariant(m.message.kind),
        hash: m.messageHash,
        seqno: (m.message.seqno as Long).toNumber(),
      }))
    )}`
  );

  const incomingMergeResult = await mergeConfigsWithIncomingUpdates(configMessages);
  await processMergingResults(incomingMergeResult);
}

async function updateOurProfileLegacyOrViaLibSession(
  sentAt: number,
  displayName: string,
  profileUrl: string | null,
  profileKey: Uint8Array | null,
  priority: number | null // passing null means to not update the priority at all (used for legacy config message for now)
) {
  await ProfileManager.updateOurProfileSync(displayName, profileUrl, profileKey, priority);

  await setLastProfileUpdateTimestamp(toNumber(sentAt));
  // do not trigger a signin by linking if the display name is empty
  if (!isEmpty(displayName)) {
    trigger(configurationMessageReceived, displayName);
  } else {
    window?.log?.warn('Got a configuration message but the display name is empty');
  }
}

async function handleOurProfileUpdateLegacy(
  sentAt: number | Long,
  configMessage: SignalService.ConfigurationMessage
) {
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();
  // we want to allow if we are not registered, as we might need to fetch an old config message (can be removed once we released for a weeks the libsession util)
  if (userConfigLibsession && !isSignInByLinking()) {
    return;
  }
  const latestProfileUpdateTimestamp = getLastProfileUpdateTimestamp();
  if (!latestProfileUpdateTimestamp || sentAt > latestProfileUpdateTimestamp) {
    window?.log?.info(
      `Handling our profileUdpate ourLastUpdate:${latestProfileUpdateTimestamp}, envelope sent at: ${sentAt}`
    );
    const { profileKey, profilePicture, displayName } = configMessage;

    await updateOurProfileLegacyOrViaLibSession(
      toNumber(sentAt),
      displayName,
      profilePicture,
      profileKey,
      null // passing null to say do not the prioroti, as we do not get one from the legacy config message
    );
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

  // we only want to apply changes to closed groups if we never got them
  // new opengroups get added when we get a new closed group message from someone, or a sync'ed message from outself creating the group
  if (!lastConfigTimestamp) {
    await handleClosedGroupsFromConfigLegacy(configMessage.closedGroups, envelope);
  }

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
 * Trigger a join for all closed groups which doesn't exist yet
 * @param openGroups string array of open group urls
 */
const handleClosedGroupsFromConfigLegacy = async (
  closedGroups: Array<SignalService.ConfigurationMessage.IClosedGroup>,
  envelope: EnvelopePlus
) => {
  const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

  if (userConfigLibsession && Registration.isDone()) {
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
        await handleNewClosedGroup(envelope, groupUpdate);
      } catch (e) {
        window?.log?.warn('failed to handle a new closed group from configuration message');
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
    return removeFromCache(envelope);
  }

  await handleOurProfileUpdateLegacy(envelope.timestamp, configurationMessage);
  await handleGroupsAndContactsFromConfigMessageLegacy(envelope, configurationMessage);
  await removeFromCache(envelope);
}

export const ConfigMessageHandler = {
  handleConfigurationMessageLegacy,
  handleConfigMessagesViaLibSession,
};
