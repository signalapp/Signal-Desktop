import { isEmpty, uniq } from 'lodash';
import { CommunityInfo } from 'session_util_wrapper';
import { OpenGroupData } from '../../../data/opengroups';
import { ConversationModel } from '../../../models/conversation';
import { getCommunityInfoFromDBValues } from '../../../types/sqlSharedTypes';
import { UserGroupsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { OpenGroupUtils } from '../../apis/open_group_api/utils';
import { getConversationController } from '../../conversations';

/**
 * The key of this map is the convoId as stored in the database.
 * Note: the wrapper clean
 */
const mappedCommunityWrapperValues = new Map<string, CommunityInfo>();

/**
 * Update the UserGroupsWrapper with all the data is cares about from the database.
 */
async function insertAllUserGroupsIntoWrapper() {
  const convoIdsToInsert = uniq(
    getConversationController()
      .getConversations()
      .filter(filterUserGroupsToStoreInWrapper)
      .map(m => m.id)
  );

  const communitiesIdsToInsert = uniq(
    getConversationController()
      .getConversations()
      .filter(filterUserCommunitiesToStoreInWrapper)
      .map(m => m.id)
  );

  window.log.debug(
    `UserGroupsWrapper keep tracks of ${convoIdsToInsert.length} usergroups of which ${communitiesIdsToInsert.length} are communities`
  );

  for (let index = 0; index < convoIdsToInsert.length; index++) {
    const id = convoIdsToInsert[index];

    await insertGroupsFromDBIntoWrapperAndRefresh(id);
  }
}

/**
 * Returns true if that conversation is an active group
 */
function filterUserGroupsToStoreInWrapper(convo: ConversationModel): boolean {
  return convo.isGroup() && convo.isActive();
}

function filterUserCommunitiesToStoreInWrapper(convo: ConversationModel): boolean {
  return convo.isPublic() && convo.isActive();
}

/**
 * Fetches the specified convo and updates the required field in the wrapper.
 * If that community does not exist in the wrapper, it is created before being updated.
 */
async function insertGroupsFromDBIntoWrapperAndRefresh(convoId: string): Promise<void> {
  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo) {
    return;
  }

  if (!filterUserGroupsToStoreInWrapper(foundConvo)) {
    return;
  }

  if (foundConvo.isOpenGroupV2()) {
    const asOpengroup = foundConvo.toOpenGroupV2();
    const isPinned = !!foundConvo.get('isPinned');

    const roomDetails = OpenGroupData.getV2OpenGroupRoomByRoomId(asOpengroup);
    if (!roomDetails) {
      return;
    }

    // we need to build the full URL with the pubkey so we can add it to the wrapper. Let's reuse the exposed method from the wrapper for that
    const fullUrl = await UserGroupsWrapperActions.buildFullUrlFromDetails(
      roomDetails.serverUrl,
      roomDetails.roomId,
      roomDetails.serverPublicKey
    );

    const wrapperComm = getCommunityInfoFromDBValues({
      isPinned,
      fullUrl,
    });

    try {
      console.info(`inserting into usergroup wrapper ${convoId}...`);
      // this does the create or the update of the matching existing community
      await UserGroupsWrapperActions.setCommunityByFullUrl(
        wrapperComm.fullUrl,
        wrapperComm.priority
      );
    } catch (e) {
      window.log.warn(`UserGroupsWrapperActions.set of ${convoId} failed with ${e.message}`);
      // we still let this go through
    }

    await refreshCommunityMappedValue(convoId);
  } else {
    // TODO
    // throw new Error('insertGroupsFromDBIntoWrapperAndRefresh group and legacy todo');
  }
}

/**
 * refreshMappedValue is used to query the UserGroups Wrapper for the details of that group and update the cached in-memory entry representing its content.
 * @param id the pubkey to re fresh the cached value from
 * @param duringAppStart set this to true if we should just fetch the cached value but not trigger a UI refresh of the corresponding conversation
 */
async function refreshCommunityMappedValue(convoId: string, duringAppStart = false) {
  try {
    if (!OpenGroupUtils.isOpenGroupV2(convoId)) {
      throw new Error(`Not an opengroupv2: "${convoId}"`);
    }
    const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(convoId);
    if (fromWrapper) {
      SessionUtilUserGroups.setCommunityMappedValue(convoId, fromWrapper);
      if (!duringAppStart) {
        getConversationController()
          .get(convoId)
          ?.triggerUIRefresh();
      }
    }
    return;
  } catch (e) {
    window.log.info(`refreshCommunityMappedValue: not an opengroup convoID: ${convoId}`, e);
  }

  // TODO
  // throw new Error('refreshMappedValue group and legacy todo');
}

function setCommunityMappedValue(convoId: string, info: CommunityInfo) {
  if (isEmpty(info.fullUrl)) {
    throw new Error(`setCommunityMappedValue needs a valid info.fullUrl ${info.fullUrl}`);
  }

  // this has the pubkey associated with it
  mappedCommunityWrapperValues.set(convoId, info);
}

function getCommunityMappedValueByConvoId(convoId: string) {
  return mappedCommunityWrapperValues.get(convoId);
}

function getAllCommunities(): Array<CommunityInfo> {
  return [...mappedCommunityWrapperValues.values()];
}

/**
 * Remove the matching community from the wrapper and from the cached list of communities
 */
async function removeCommunityFromWrapper(convoId: string, fullUrlWithOrWithoutPubkey: string) {
  const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(
    fullUrlWithOrWithoutPubkey
  );

  if (fromWrapper) {
    await UserGroupsWrapperActions.eraseCommunityByFullUrl(fromWrapper.fullUrl);
  }
  // might not be there but better make sure
  mappedCommunityWrapperValues.delete(convoId);
}

export const SessionUtilUserGroups = {
  filterUserGroupsToStoreInWrapper,
  filterUserCommunitiesToStoreInWrapper,
  getAllCommunities,
  insertAllUserGroupsIntoWrapper,
  insertGroupsFromDBIntoWrapperAndRefresh,
  setCommunityMappedValue,
  getCommunityMappedValueByConvoId,
  refreshCommunityMappedValue,
  removeCommunityFromWrapper,
};
