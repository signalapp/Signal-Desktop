import { isEmpty } from 'lodash';
import { UserUtils } from '..';
import { UserConfigWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';
import { fromHexToArray } from '../String';
import { CONVERSATION_PRIORITIES } from '../../../models/conversationAttributes';

async function insertUserProfileIntoWrapper(convoId: string) {
  if (!isUserProfileToStoreInWrapper(convoId)) {
    return;
  }
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = getConversationController().get(us);

  if (!ourConvo) {
    throw new Error('insertUserProfileIntoWrapper needs a ourConvo to exist');
  }

  const dbName = ourConvo.get('displayNameInProfile') || '';
  const dbProfileUrl = ourConvo.get('avatarPointer') || '';
  const dbProfileKey = fromHexToArray(ourConvo.get('profileKey') || '');
  const priority = ourConvo.get('priority') || CONVERSATION_PRIORITIES.default;

  window.log.debug(
    `inserting into userprofile wrapper: username:"${dbName}", priority:${priority} image:${JSON.stringify(
      { url: dbProfileUrl, key: dbProfileKey }
    )} `
  );
  // const expirySeconds = ourConvo.get('expireTimer') || 0;
  if (dbProfileUrl && !isEmpty(dbProfileKey)) {
    await UserConfigWrapperActions.setUserInfo(
      dbName,
      priority,
      {
        url: dbProfileUrl,
        key: dbProfileKey,
      }
      // expirySeconds
    );
  } else {
    await UserConfigWrapperActions.setUserInfo(dbName, priority, null); // expirySeconds
  }
}

function isUserProfileToStoreInWrapper(convoId: string) {
  try {
    const us = UserUtils.getOurPubKeyStrFromCache();
    return convoId === us;
  } catch (e) {
    return false;
  }
}

export const SessionUtilUserProfile = {
  insertUserProfileIntoWrapper,
  isUserProfileToStoreInWrapper,
};
