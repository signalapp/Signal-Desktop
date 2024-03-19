/* eslint-disable no-case-declarations */
import { BaseConvoInfoVolatile, ConvoVolatileType } from 'libsession_util_nodejs';
import { isEmpty, isFinite } from 'lodash';
import { Data } from '../../../data/data';
import { OpenGroupData } from '../../../data/opengroups';
import { ConversationModel } from '../../../models/conversation';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import {
  ConvoInfoVolatileWrapperActions,
  UserGroupsWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { OpenGroupUtils } from '../../apis/open_group_api/utils';
import { getConversationController } from '../../conversations';
import { SessionUtilContact } from './libsession_utils_contacts';
import { SessionUtilUserGroups } from './libsession_utils_user_groups';
import { SessionUtilUserProfile } from './libsession_utils_user_profile';

/**
 * The key of this map is the convoId as stored in the database.
 */
const mapped1o1WrapperValues = new Map<string, BaseConvoInfoVolatile>();

/**
 * The key of this map is the convoId as stored in the database. So the legacy group 05 sessionID
 */
const mappedLegacyGroupWrapperValues = new Map<string, BaseConvoInfoVolatile>();

/**
 * The key of this map is the convoId as stored in the database, so withoutpubkey
 */
const mappedCommunityWrapperValues = new Map<string, BaseConvoInfoVolatile>();

/**
 * Returns true if that conversation should be stored in the conversation volatile info wrapper.
 * It actually relies on the two other wrappers to know what to store:
 *    - Usergroups to know which communities and legacy group to store
 *    - Contacts to know which contacts to store
 *    - UserProfile to keep track of the `unread` state of the Note To Self conversation
 */
function isConvoToStoreInWrapper(convo: ConversationModel): boolean {
  return (
    SessionUtilUserGroups.isUserGroupToStoreInWrapper(convo) || // this checks for community & legacy group
    SessionUtilContact.isContactToStoreInWrapper(convo) || // this checks for contacts
    SessionUtilUserProfile.isUserProfileToStoreInWrapper(convo.id) // this checks for our own pubkey, as we want to keep track of the read state for the Note To Self
  );
}

function getConvoType(convo: ConversationModel): ConvoVolatileType {
  const convoType: ConvoVolatileType =
    SessionUtilContact.isContactToStoreInWrapper(convo) ||
    SessionUtilUserProfile.isUserProfileToStoreInWrapper(convo.id)
      ? '1o1'
      : SessionUtilUserGroups.isCommunityToStoreInWrapper(convo)
        ? 'Community'
        : 'LegacyGroup';

  return convoType;
}

/**
 * Updates the required field in the wrapper from the data from the `ConversationController`
 * If that community does not exist in the wrapper, it is created before being updated.
 * Same applies for a legacy group.
 */
async function insertConvoFromDBIntoWrapperAndRefresh(convoId: string): Promise<void> {
  // this is too slow to fetch from the database the up to date data here. Let's hope that what we have in memory is up to date enough
  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo || !isConvoToStoreInWrapper(foundConvo)) {
    return;
  }
  const isForcedUnread = foundConvo.isMarkedUnread();
  const timestampFromDbMs = (await Data.fetchConvoMemoryDetails(convoId))?.lastReadTimestampMessage;

  // Note: not having a last read timestamp fallsback to 0, which keeps the existing value in the wrapper if it is already set (as done in src/convo_info_volatile_config.cpp)
  // we actually do the max() of whatever is inside the wrapper and the value from the DB
  const lastReadMessageTimestamp =
    !!timestampFromDbMs && isFinite(timestampFromDbMs) && timestampFromDbMs > 0
      ? timestampFromDbMs
      : 0;

  window.log.debug(
    `inserting into convoVolatile wrapper: ${convoId} lastMessageReadTimestamp:${lastReadMessageTimestamp} forcedUnread:${isForcedUnread}...`
  );

  const convoType = getConvoType(foundConvo);
  switch (convoType) {
    case '1o1':
      try {
        // this saves the details for contacts and `Note To Self`
        await ConvoInfoVolatileWrapperActions.set1o1(
          convoId,
          lastReadMessageTimestamp,
          isForcedUnread
        );
        await refreshConvoVolatileCached(convoId, false, false);
      } catch (e) {
        window.log.warn(
          `ConvoInfoVolatileWrapperActions.set1o1 of ${convoId} failed with ${e.message}`
        );
      }
      break;
    case 'LegacyGroup':
      try {
        await ConvoInfoVolatileWrapperActions.setLegacyGroup(
          convoId,
          lastReadMessageTimestamp,
          isForcedUnread
        );
        await refreshConvoVolatileCached(convoId, true, false);
      } catch (e) {
        window.log.warn(
          `ConvoInfoVolatileWrapperActions.setLegacyGroup of ${convoId} failed with ${e.message}`
        );
      }
      break;
    case 'Community':
      try {
        const asOpengroup = foundConvo.toOpenGroupV2();
        const roomDetails = OpenGroupData.getV2OpenGroupRoomByRoomId(asOpengroup);
        if (!roomDetails || isEmpty(roomDetails.serverPublicKey)) {
          return;
        }

        // we need to build the full URL with the pubkey so we can add it to the wrapper. Let's reuse the exposed method from the wrapper for that
        const fullUrlWithPubkey = await UserGroupsWrapperActions.buildFullUrlFromDetails(
          roomDetails.serverUrl,
          roomDetails.roomId,
          roomDetails.serverPublicKey
        );

        // this does the create or the update of the matching existing community
        await ConvoInfoVolatileWrapperActions.setCommunityByFullUrl(
          fullUrlWithPubkey,
          lastReadMessageTimestamp,
          isForcedUnread
        );

        await refreshConvoVolatileCached(convoId, false, false);
      } catch (e) {
        window.log.warn(
          `ConvoInfoVolatileWrapperActions.setCommunityByFullUrl of ${convoId} failed with ${e.message}`
        );
      }
      break;
    default:
      assertUnreachable(
        convoType,
        `insertConvoFromDBIntoWrapperAndRefresh unhandled case "${convoType}"`
      );
  }
}

/**
 * @param isLegacyGroup we need this to know if the corresponding 05 starting pubkey is associated with a legacy group or not
 * @param duringAppStart set this to true if we should just fetch the cached value but not trigger a UI refresh of the corresponding conversation
 */
async function refreshConvoVolatileCached(
  convoId: string,
  isLegacyGroup: boolean,
  duringAppStart: boolean
) {
  try {
    let convoType: ConvoVolatileType = '1o1';
    let refreshed = false;

    if (OpenGroupUtils.isOpenGroupV2(convoId)) {
      convoType = 'Community';
    } else if (convoId.startsWith('05') && isLegacyGroup) {
      convoType = 'LegacyGroup';
    } else if (convoId.startsWith('05')) {
      convoType = '1o1';
    }

    switch (convoType) {
      case '1o1':
        const fromWrapper1o1 = await ConvoInfoVolatileWrapperActions.get1o1(convoId);
        if (fromWrapper1o1) {
          mapped1o1WrapperValues.set(convoId, fromWrapper1o1);
        }
        refreshed = true;
        break;
      case 'LegacyGroup':
        const fromWrapperLegacyGroup =
          await ConvoInfoVolatileWrapperActions.getLegacyGroup(convoId);
        if (fromWrapperLegacyGroup) {
          mappedLegacyGroupWrapperValues.set(convoId, fromWrapperLegacyGroup);
        }
        refreshed = true;
        break;
      case 'Community':
        const fromWrapperCommunity = await ConvoInfoVolatileWrapperActions.getCommunity(convoId);
        if (fromWrapperCommunity && fromWrapperCommunity.fullUrlWithPubkey) {
          mappedCommunityWrapperValues.set(convoId, fromWrapperCommunity);
        }
        refreshed = true;
        break;

      default:
        assertUnreachable(convoType, `refreshConvoVolatileCached unhandled case "${convoType}"`);
    }

    if (refreshed && !duringAppStart) {
      getConversationController().get(convoId)?.triggerUIRefresh();
    }
  } catch (e) {
    window.log.info(`refreshMappedValue for volatile convoID: ${convoId}`, e.message);
  }
}

function getVolatileInfoCached(convoId: string): BaseConvoInfoVolatile | undefined {
  return (
    mapped1o1WrapperValues.get(convoId) ||
    mappedLegacyGroupWrapperValues.get(convoId) ||
    mappedCommunityWrapperValues.get(convoId)
  );
}

/**
 * Removes the matching community from the wrapper and from the cached list of communities
 */
async function removeCommunityFromWrapper(convoId: string, fullUrlWithPubkey: string) {
  try {
    await ConvoInfoVolatileWrapperActions.eraseCommunityByFullUrl(fullUrlWithPubkey);
  } catch (e) {
    window.log.warn('removeCommunityFromWrapper failed with ', e.message);
  }

  mappedCommunityWrapperValues.delete(convoId);
}

/**
 * Removes the matching legacy group from the wrapper and from the cached list of legacy groups
 */
async function removeLegacyGroupFromWrapper(convoId: string) {
  try {
    await ConvoInfoVolatileWrapperActions.eraseLegacyGroup(convoId);
  } catch (e) {
    window.log.warn('removeLegacyGroupFromWrapper failed with ', e.message);
  }
  mappedLegacyGroupWrapperValues.delete(convoId);
}

/**
 * Removes the matching legacy group from the wrapper and from the cached list of legacy groups
 */
async function removeContactFromWrapper(convoId: string) {
  try {
    await ConvoInfoVolatileWrapperActions.erase1o1(convoId);
  } catch (e) {
    window.log.warn('removeContactFromWrapper failed with ', e.message);
  }
  mapped1o1WrapperValues.delete(convoId);
}

/**
 * This function can be used where there are things to do for all the types handled by this wrapper.
 * You can do a loop on all the types handled by this wrapper and have a switch using assertUnreachable to get errors when not every case is handled.
 *
 *
 * Note: Ideally, we'd like to have this type in the wrapper index.d.ts,
 * but it would require it to be a index.ts instead, which causes a
 * whole other bunch of issues because it is a native node module.
 */
function getConvoInfoVolatileTypes(): Array<ConvoVolatileType> {
  return ['1o1', 'LegacyGroup', 'Community'];
}

export const SessionUtilConvoInfoVolatile = {
  // shared
  isConvoToStoreInWrapper,
  insertConvoFromDBIntoWrapperAndRefresh,
  refreshConvoVolatileCached,
  getConvoInfoVolatileTypes,
  getVolatileInfoCached,

  // 1o1
  removeContactFromWrapper,

  // legacy group
  removeLegacyGroupFromWrapper, // a group can be removed but also just marked hidden, so only call this function when the group is completely removed // TODOLATER

  // communities
  removeCommunityFromWrapper,
};
