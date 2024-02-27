/* eslint-disable no-case-declarations */
import { CommunityInfo, LegacyGroupInfo, UserGroupsType } from 'libsession_util_nodejs';
import { Data } from '../../../data/data';
import { OpenGroupData } from '../../../data/opengroups';
import { ConversationModel } from '../../../models/conversation';
import {
  CommunityInfoFromDBValues,
  assertUnreachable,
  getCommunityInfoFromDBValues,
  getLegacyGroupInfoFromDBValues,
} from '../../../types/sqlSharedTypes';
import { UserGroupsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';

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
 * We do not want to include groups left in the wrapper, but when receiving a list
 * of wrappers from the network we need to check against the one present locally
 * but already left, to know we need to remove them.
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
async function insertGroupsFromDBIntoWrapperAndRefresh(
  convoId: string
): Promise<CommunityInfoFromDBValues | LegacyGroupInfo | null> {
  const foundConvo = getConversationController().get(convoId);
  if (!foundConvo) {
    return null;
  }

  if (!SessionUtilUserGroups.isUserGroupToStoreInWrapper(foundConvo)) {
    return null;
  }

  const convoType: UserGroupsType = SessionUtilUserGroups.isCommunityToStoreInWrapper(foundConvo)
    ? 'Community'
    : 'LegacyGroup';

  switch (convoType) {
    case 'Community':
      const asOpengroup = foundConvo.toOpenGroupV2();

      const roomDetails = OpenGroupData.getV2OpenGroupRoomByRoomId(asOpengroup);
      if (!roomDetails) {
        return null;
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
        window.log.debug(`inserting into usergroup wrapper "${JSON.stringify(wrapperComm)}"...`);
        // this does the create or the update of the matching existing community
        await UserGroupsWrapperActions.setCommunityByFullUrl(
          wrapperComm.fullUrl,
          wrapperComm.priority
        );

        // returned for testing purposes only
        return {
          fullUrl: wrapperComm.fullUrl,
          priority: wrapperComm.priority,
        };
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
        expirationMode: foundConvo.getExpirationMode() || 'off',
        expireTimer: foundConvo.getExpireTimer() || 0,
        displayNameInProfile: foundConvo.get('displayNameInProfile'),
        encPubkeyHex: encryptionKeyPair?.publicHex || '',
        encSeckeyHex: encryptionKeyPair?.privateHex || '',
        lastJoinedTimestamp: foundConvo.get('lastJoinedTimestamp') || 0,
      });

      try {
        window.log.debug(
          `inserting into usergroup wrapper "${foundConvo.id}"... }`,
          JSON.stringify(wrapperLegacyGroup)
        );
        // this does the create or the update of the matching existing legacy group
        await UserGroupsWrapperActions.setLegacyGroup(wrapperLegacyGroup);
        // returned for testing purposes only
        return wrapperLegacyGroup;
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
  return null;
}

async function getCommunityByConvoIdNotCached(convoId: string) {
  return UserGroupsWrapperActions.getCommunityByFullUrl(convoId);
}

async function getAllCommunitiesNotCached(): Promise<Array<CommunityInfo>> {
  return UserGroupsWrapperActions.getAllCommunities();
}

/**
 * Removes the matching community from the wrapper and from the cached list of communities
 */
async function removeCommunityFromWrapper(_convoId: string, fullUrlWithOrWithoutPubkey: string) {
  const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(
    fullUrlWithOrWithoutPubkey
  );

  if (fromWrapper) {
    await UserGroupsWrapperActions.eraseCommunityByFullUrl(fromWrapper.fullUrlWithPubkey);
  }
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
function getUserGroupTypes(): Array<UserGroupsType> {
  return ['Community', 'LegacyGroup'];
}

export const SessionUtilUserGroups = {
  // shared
  isUserGroupToStoreInWrapper,
  insertGroupsFromDBIntoWrapperAndRefresh,
  getUserGroupTypes,

  // communities
  isCommunityToStoreInWrapper,
  getAllCommunitiesNotCached,
  getCommunityByConvoIdNotCached,
  removeCommunityFromWrapper,

  // legacy group
  isLegacyGroupToStoreInWrapper,
  isLegacyGroupToRemoveFromDBIfNotInWrapper,

  removeLegacyGroupFromWrapper, // a group can be removed but also just marked hidden, so only call this function when the group is completely removed // TODOLATER
};
