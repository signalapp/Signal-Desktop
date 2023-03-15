import { uniq } from 'lodash';
import { BaseConvoInfoVolatile, ConvoVolatileType } from 'session_util_wrapper';
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
 * Update the ConvoInfoVolatileWrapper with all the data is cares about from the database.
 */
async function insertAllConvoInfoVolatileIntoWrapper() {
  const convoIdsToInsert = uniq(
    getConversationController()
      .getConversations()
      .filter(isConvoToStoreInWrapper)
      .map(m => m.id)
  );

  window.log.debug(
    `ConvoInfoVolatileWrapper keep tracks of ${convoIdsToInsert.length} convos in total.`
  );

  for (let index = 0; index < convoIdsToInsert.length; index++) {
    const id = convoIdsToInsert[index];

    await insertConvoFromDBIntoWrapperAndRefresh(id);
  }
}

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
    SessionUtilContact.isContactToStoreInContactsWrapper(convo) || // this checks for contacts
    SessionUtilUserProfile.isUserProfileToStoreInContactsWrapper(convo.id) // this checks for out own pubkey, as we want to keep track of the read state for the Note To Self
  );
}
function getConvoType(convo: ConversationModel): ConvoVolatileType {
  const convoType: ConvoVolatileType =
    SessionUtilContact.isContactToStoreInContactsWrapper(convo) ||
    SessionUtilUserProfile.isUserProfileToStoreInContactsWrapper(convo.id)
      ? '1o1'
      : SessionUtilUserGroups.isCommunityToStoreInWrapper(convo)
      ? 'Community'
      : 'LegacyGroup';

  return convoType;
}

/**
 * Fetches the specified convo and updates the required field in the wrapper.
 * If that community does not exist in the wrapper, it is created before being updated.
 * Same applies for a legacy group.
 */
async function insertConvoFromDBIntoWrapperAndRefresh(convoId: string): Promise<void> {
  const foundConvo = await Data.getConversationById(convoId);
  if (!foundConvo || !isConvoToStoreInWrapper(foundConvo)) {
    return;
  }

  const isForcedUnread = foundConvo.isMarkedUnread();
  const lastReadTimestampMessage = foundConvo.getCachedLastReadTimestampMessage() || 0;

  console.info(
    `convoInfoVolatile:insert "${convoId}";lastMessageReadTimestamp:${lastReadTimestampMessage};forcedUnread:${isForcedUnread}...`
  );

  const convoType = getConvoType(foundConvo);
  switch (convoType) {
    case '1o1':
      try {
        // this saves the details for contacts and `Note To Self`
        await ConvoInfoVolatileWrapperActions.set1o1(
          convoId,
          lastReadTimestampMessage,
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
          lastReadTimestampMessage,
          isForcedUnread
        );
        await refreshConvoVolatileCached(convoId, true, false);
      } catch (e) {
        window.log.warn(
          `ConvoInfoVolatileWrapperActions.setLegacyGroup of ${convoId} failed with ${e.message}`
        );
        // we stil let this go through
      }
      break;
    case 'Community':
      try {
        const asOpengroup = foundConvo.toOpenGroupV2();
        const roomDetails = OpenGroupData.getV2OpenGroupRoomByRoomId(asOpengroup);
        if (!roomDetails) {
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
          lastReadTimestampMessage,
          isForcedUnread
        );
        await refreshConvoVolatileCached(convoId, false, false);
      } catch (e) {
        window.log.warn(
          `ConvoInfoVolatileWrapperActions.setCommunityByFullUrl of ${convoId} failed with ${e.message}`
        );
        // we still let this go through
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
    let refreshed = false;
    if (OpenGroupUtils.isOpenGroupV2(convoId)) {
      const fromWrapper = await ConvoInfoVolatileWrapperActions.getCommunity(convoId);
      if (fromWrapper && fromWrapper.fullUrlWithPubkey) {
        mappedCommunityWrapperValues.set(convoId, fromWrapper);
      }
      refreshed = true;
    } else if (convoId.startsWith('05') && isLegacyGroup) {
      const fromWrapper = await ConvoInfoVolatileWrapperActions.getLegacyGroup(convoId);
      if (fromWrapper) {
        mappedLegacyGroupWrapperValues.set(convoId, fromWrapper);
      }
      refreshed = true;
    } else if (convoId.startsWith('05')) {
      const fromWrapper = await ConvoInfoVolatileWrapperActions.get1o1(convoId);
      console.warn(
        `refreshMappedValues from get1o1 ${fromWrapper?.pubkeyHex} : ${fromWrapper?.unread}`
      );
      if (fromWrapper) {
        mapped1o1WrapperValues.set(convoId, fromWrapper);
      }
      refreshed = true;
    } // TODO handle the new closed groups once we got them ready

    if (refreshed && !duringAppStart) {
      getConversationController()
        .get(convoId)
        ?.triggerUIRefresh();
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
async function removeCommunityFromWrapper(convoId: string, fullUrlWithOrWithoutPubkey: string) {
  try {
    await ConvoInfoVolatileWrapperActions.eraseCommunityByFullUrl(fullUrlWithOrWithoutPubkey);
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
 * This function can be used where there are things to do for all the types handled by this wrapper.
 * You can do a loop on all the types handled by this wrapper and have a switch using assertUnreachable to get errors when not every case is handled.
 *
 *
 * Note: Ideally, we'd like to have this type in the wrapper index.d.ts, but it would require it to be a index.ts instead, which causes a whole other bunch of issues because it is a native node module.
 */
function getConvoInfoVolatileTypes(): Array<ConvoVolatileType> {
  return ['1o1', 'LegacyGroup', 'Community'];
}

export const SessionUtilConvoInfoVolatile = {
  // shared
  isConvoToStoreInWrapper,
  insertAllConvoInfoVolatileIntoWrapper,
  insertConvoFromDBIntoWrapperAndRefresh,
  refreshConvoVolatileCached,
  getConvoInfoVolatileTypes,
  getVolatileInfoCached,

  // 1o1
  // at the moment, we cannot remove a 1o1 from the conversation volatile info.

  // legacy group
  removeLegacyGroupFromWrapper, // a group can be removed but also just marked hidden, so only call this function when the group is completely removed // TODO

  // communities
  removeCommunityFromWrapper,
};
