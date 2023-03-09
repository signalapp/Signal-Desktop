import { uniq } from 'lodash';
import {
  ConvoInfoVolatile1o1,
  ConvoInfoVolatileCommunity,
  ConvoInfoVolatileLegacyGroup,
  ConvoVolatileType,
} from 'session_util_wrapper';
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

/**
 * The key of this map is the convoId as stored in the database.
 */
const mapped1o1WrapperValues = new Map<string, ConvoInfoVolatile1o1>();

/**
 * The key of this map is the convoId as stored in the database. So the legacy group 05 sessionID
 */
const mappedLegacyGroupWrapperValues = new Map<string, ConvoInfoVolatileLegacyGroup>();

/**
 * The key of this map is the convoId as stored in the database, so withoutpubkey
 */
const mappedCommunityWrapperValues = new Map<string, ConvoInfoVolatileCommunity>();

/**
 * Update the ConvoInfoVolatileWrapper with all the data is cares about from the database.
 */
async function insertAllConvosIntoWrapper() {
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
 */
function isConvoToStoreInWrapper(convo: ConversationModel): boolean {
  return (
    SessionUtilUserGroups.isUserGroupToStoreInWrapper(convo) || // this checks for community & legacy group
    SessionUtilContact.isContactToStoreInContactsWrapper(convo) // this checks for contacts
  );
}
function getConvoType(convo: ConversationModel): ConvoVolatileType {
  const convoType: ConvoVolatileType = SessionUtilContact.isContactToStoreInContactsWrapper(convo)
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
  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo) {
    return;
  }

  if (!isConvoToStoreInWrapper(foundConvo)) {
    return;
  }

  console.info(`inserting into convoInfoVolatile wrapper "${convoId}"...`);

  console.warn('ConvoInfoVolatileWrapperActions to finish with unread and readAt');
  const convoType = getConvoType(foundConvo);
  switch (convoType) {
    case '1o1':
      try {
        await ConvoInfoVolatileWrapperActions.set1o1(convoId, 0, false);
        await refreshMappedValue(convoId, false, false);
      } catch (e) {
        window.log.warn(
          `ConvoInfoVolatileWrapperActions.set1o1 of ${convoId} failed with ${e.message}`
        );
      }
      break;
    case 'LegacyGroup':
      try {
        await ConvoInfoVolatileWrapperActions.setLegacyGroup(convoId, 0, false);
        await refreshMappedValue(convoId, true, false);
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
        console.info(`inserting into convoInfoVolatile wrapper "${fullUrlWithPubkey}"...`);
        // this does the create or the update of the matching existing community
        await ConvoInfoVolatileWrapperActions.setCommunityByFullUrl(fullUrlWithPubkey, 0, false);
        await refreshMappedValue(convoId, false, false);
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
async function refreshMappedValue(
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
      if (fromWrapper) {
        mapped1o1WrapperValues.set(convoId, fromWrapper);
      }
      refreshed = true;
    }

    if (refreshed && !duringAppStart) {
      getConversationController()
        .get(convoId)
        ?.triggerUIRefresh();
    }
  } catch (e) {
    window.log.info(`refreshMappedValue for volatile convoID: ${convoId}`, e.message);
  }

  // TODO handle the new closed groups once we got them ready
}

function get1o1(convoId: string): ConvoInfoVolatile1o1 | undefined {
  return mapped1o1WrapperValues.get(convoId);
}

function getAll1o1(): Array<ConvoInfoVolatile1o1> {
  return [...mapped1o1WrapperValues.values()];
}

function getCommunityMappedValueByConvoId(convoId: string) {
  return mappedCommunityWrapperValues.get(convoId);
}

function getAllCommunities(): Array<ConvoInfoVolatileCommunity> {
  return [...mappedCommunityWrapperValues.values()];
}

function getLegacyGroupMappedValueByConvoId(convoId: string) {
  return mappedLegacyGroupWrapperValues.get(convoId);
}

function getAllLegacyGroups(): Array<ConvoInfoVolatileLegacyGroup> {
  return [...mappedLegacyGroupWrapperValues.values()];
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
  insertAllConvosIntoWrapper,
  insertConvoFromDBIntoWrapperAndRefresh,
  refreshMappedValue,
  getConvoInfoVolatileTypes,

  // 1o1
  get1o1,
  getAll1o1,
  // removeCommunityFromWrapper,

  // legacy group
  getLegacyGroupMappedValueByConvoId,
  getAllLegacyGroups,
  // removeLegacyGroupFromWrapper, // a group can be removed but also just marked hidden, so only call this function when the group is completely removed // TODO

  // communities
  getAllCommunities,
  getCommunityMappedValueByConvoId,
  // removeCommunityFromWrapper,
};
