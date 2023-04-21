import { uniq } from 'lodash';
import { CommunityInfo, LegacyGroupInfo, UserGroupsType } from 'libsession_util_nodejs';
import { Data } from '../../../data/data';
import { OpenGroupData } from '../../../data/opengroups';
import { ConversationModel } from '../../../models/conversation';
import {
  assertUnreachable,
  getCommunityInfoFromDBValues,
  getLegacyGroupInfoFromDBValues,
} from '../../../types/sqlSharedTypes';
import { UserGroupsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { OpenGroupUtils } from '../../apis/open_group_api/utils';
import { getConversationController } from '../../conversations';

/**
 * The key of this map is the convoId as stored in the database.
 */
const mappedCommunityWrapperValues = new Map<string, CommunityInfo>();

/**
 * The key of this map is the convoId as stored in the database. So the legacy group 05 sessionID
 */
const mappedLegacyGroupWrapperValues = new Map<string, LegacyGroupInfo>();

/**
 * Update the UserGroupsWrapper with all the data is cares about from the database.
 */
async function insertAllUserGroupsIntoWrapper() {
  const convoIdsToInsert = uniq(
    getConversationController()
      .getConversations()
      .filter(isUserGroupToStoreInWrapper)
      .map(m => m.id)
  );

  window.log.debug(
    `UserGroupsWrapper keep tracks of ${convoIdsToInsert.length} usergroups including groups and communities`
  );

  for (let index = 0; index < convoIdsToInsert.length; index++) {
    const id = convoIdsToInsert[index];

    await insertGroupsFromDBIntoWrapperAndRefresh(id);
  }
}

/**
 * Returns true if that conversation is an active group
 */
function isUserGroupToStoreInWrapper(convo: ConversationModel): boolean {
  return isCommunityToStoreInWrapper(convo) || isLegacyGroupToStoreInWrapper(convo);
}

function isCommunityToStoreInWrapper(convo: ConversationModel): boolean {
  return convo.isGroup() && convo.isPublic() && convo.isActive();
}

function isLegacyGroupToStoreInWrapper(convo: ConversationModel): boolean {
  return (
    convo.isGroup() &&
    !convo.isPublic() &&
    convo.id.startsWith('05') && // new closed groups won't start with 05
    convo.isActive() &&
    !convo.get('isKickedFromGroup') &&
    !convo.get('left')
  );
}

/**
 * We do not want to include groups left in the wrapper, but when receiving a list of wrappers from the network we need to check against the one present locally but already left, to know we need to remove them.
 *
 * This is to take care of this case:
 * - deviceA creates group
 * - deviceB joins group
 * - deviceA leaves the group
 * - deviceB leaves the group
 * - deviceA removes the group entirely from the wrapper
 * - deviceB receives the wrapper update and needs to remove the group from the DB
 *
 * But, as the group was already left, it would not be accounted for by `isLegacyGroupToStoreInWrapper`
 *
 */
function isLegacyGroupToRemoveFromDBIfNotInWrapper(convo: ConversationModel): boolean {
  // this filter is based on `isLegacyGroupToStoreInWrapper`
  return (
    convo.isGroup() && !convo.isPublic() && convo.id.startsWith('05') // new closed groups won't start with 05
  );
}

/**
 * Fetches the specified convo and updates the required field in the wrapper.
 * If that community does not exist in the wrapper, it is created before being updated.
 * Same applies for a legacy group.
 */
async function insertGroupsFromDBIntoWrapperAndRefresh(convoId: string): Promise<void> {
  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo) {
    return;
  }

  if (!isUserGroupToStoreInWrapper(foundConvo)) {
    return;
  }

  const convoType: UserGroupsType = isCommunityToStoreInWrapper(foundConvo)
    ? 'Community'
    : 'LegacyGroup';

  switch (convoType) {
    case 'Community':
      const asOpengroup = foundConvo.toOpenGroupV2();

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
        priority: foundConvo.get('priority'),
        fullUrl,
      });

      try {
        window.log.debug(`inserting into usergroup wrapper "${wrapperComm.fullUrl}"...`);
        // this does the create or the update of the matching existing community
        await UserGroupsWrapperActions.setCommunityByFullUrl(
          wrapperComm.fullUrl,
          wrapperComm.priority
        );
        await refreshCachedUserGroup(convoId);
      } catch (e) {
        window.log.warn(`UserGroupsWrapperActions.set of ${convoId} failed with ${e.message}`);
        // we still let this go through
      }
      break;

    case 'LegacyGroup':
      const encryptionKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(convoId);
      const wrapperLegacyGroup = getLegacyGroupInfoFromDBValues({
        id: foundConvo.id,
        priority: foundConvo.get('priority'),
        members: foundConvo.get('members') || [],
        groupAdmins: foundConvo.get('groupAdmins') || [],
        expireTimer: foundConvo.get('expireTimer'),
        displayNameInProfile: foundConvo.get('displayNameInProfile'),
        encPubkeyHex: encryptionKeyPair?.publicHex || '',
        encSeckeyHex: encryptionKeyPair?.privateHex || '',
        lastJoinedTimestamp: foundConvo.get('lastJoinedTimestamp') || 0,
      });

      try {
        window.log.debug(`inserting into usergroup wrapper "${foundConvo.id}"... }`);
        // this does the create or the update of the matching existing legacy group

        await UserGroupsWrapperActions.setLegacyGroup(wrapperLegacyGroup);
        await refreshCachedUserGroup(convoId);
      } catch (e) {
        window.log.warn(`UserGroupsWrapperActions.set of ${convoId} failed with ${e.message}`);
        // we still let this go through
      }
      break;

    default:
      assertUnreachable(
        convoType,
        `insertGroupsFromDBIntoWrapperAndRefresh case not handeld "${convoType}"`
      );
  }
}

/**
 * @param duringAppStart set this to true if we should just fetch the cached value but not trigger a UI refresh of the corresponding conversation
 */
async function refreshCachedUserGroup(convoId: string, duringAppStart = false) {
  try {
    let refreshed = false;
    if (OpenGroupUtils.isOpenGroupV2(convoId)) {
      const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(convoId);
      if (fromWrapper && fromWrapper.fullUrl) {
        mappedCommunityWrapperValues.set(convoId, fromWrapper);
      }
      refreshed = true;
    } else if (convoId.startsWith('05')) {
      // currently this should only be a legacy group here
      const fromWrapper = await UserGroupsWrapperActions.getLegacyGroup(convoId);
      if (fromWrapper) {
        mappedLegacyGroupWrapperValues.set(convoId, fromWrapper);
      }
      refreshed = true;
    }

    if (refreshed && !duringAppStart) {
      getConversationController()
        .get(convoId)
        ?.triggerUIRefresh();
    }
  } catch (e) {
    window.log.info(`refreshMappedValue: not an opengroup convoID: ${convoId}`, e);
  }

  // TODOLATER handle the new closed groups once we got them ready
}

function getCommunityByConvoIdCached(convoId: string) {
  return mappedCommunityWrapperValues.get(convoId);
}

function getAllCommunitiesCached(): Array<CommunityInfo> {
  return [...mappedCommunityWrapperValues.values()];
}

/**
 * Removes the matching community from the wrapper and from the cached list of communities
 */
async function removeCommunityFromWrapper(convoId: string, fullUrlWithOrWithoutPubkey: string) {
  const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(
    fullUrlWithOrWithoutPubkey
  );

  if (fromWrapper) {
    await UserGroupsWrapperActions.eraseCommunityByFullUrl(fromWrapper.fullUrl);
  }
  mappedCommunityWrapperValues.delete(convoId);
}

function getLegacyGroupCached(convoId: string) {
  return mappedLegacyGroupWrapperValues.get(convoId);
}

function getAllLegacyGroups(): Array<LegacyGroupInfo> {
  return [...mappedLegacyGroupWrapperValues.values()];
}

/**
 * Remove the matching legacy group from the wrapper and from the cached list of legacy groups
 */
async function removeLegacyGroupFromWrapper(groupPk: string) {
  try {
    await UserGroupsWrapperActions.eraseLegacyGroup(groupPk);
  } catch (e) {
    window.log.warn(
      `UserGroupsWrapperActions.eraseLegacyGroup with = ${groupPk} failed with`,
      e.message
    );
  }

  mappedLegacyGroupWrapperValues.delete(groupPk);
}

/**
 * This function can be used where there are things to do for all the types handled by this wrapper.
 * You can do a loop on all the types handled by this wrapper and have a switch using assertUnreachable to get errors when not every case is handled.
 *
 *
 * Note: Ideally, we'd like to have this type in the wrapper index.d.ts, but it would require it to be a index.ts instead, which causes a whole other bunch of issues because it is a native node module.
 */
function getUserGroupTypes(): Array<UserGroupsType> {
  return ['Community', 'LegacyGroup'];
}

export const SessionUtilUserGroups = {
  // shared
  isUserGroupToStoreInWrapper,
  insertAllUserGroupsIntoWrapper,
  insertGroupsFromDBIntoWrapperAndRefresh,
  refreshCachedUserGroup,
  getUserGroupTypes,

  // communities
  isCommunityToStoreInWrapper,
  getAllCommunitiesCached,
  getCommunityByConvoIdCached,
  removeCommunityFromWrapper,

  // legacy group
  isLegacyGroupToStoreInWrapper,
  isLegacyGroupToRemoveFromDBIfNotInWrapper,
  getLegacyGroupCached,
  getAllLegacyGroups,
  removeLegacyGroupFromWrapper, // a group can be removed but also just marked hidden, so only call this function when the group is completely removed // TODOLATER
};
