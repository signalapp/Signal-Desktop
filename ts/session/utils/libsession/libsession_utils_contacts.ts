import { ContactInfo } from 'libsession_util_nodejs';
import { ConversationModel } from '../../../models/conversation';
import { getContactInfoFromDBValues } from '../../../types/sqlSharedTypes';
import { ContactsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';
import { PubKey } from '../../types';

/**
 * This file is centralizing the management of data from the Contacts Wrapper of libsession.
 * It allows to make changes to the wrapper and keeps track of the decoded values of those in the in-memory cache named `mappedContactWrapperValues`.
 *
 * The wrapper content is just a blob which has no structure.
 * Rather than having to fetch the required data from it everytime we need it (during each rerendering), we keep a decoded cache here.
 * Essentially, on app start we load all the content from the wrapper with `SessionUtilContact.refreshMappedValue` during the ConversationController initial load.
 * Then, everytime we do a change to the contacts wrapper, we do it through `insertContactFromDBIntoWrapperAndRefresh`.
 * This applies the change from the in-memory conversationModel to the ContactsWrapper, refetch the data from it and update the decoded cache `mappedContactWrapperValues` with the up to date data.
 * It then triggers a UI refresh of that specific conversation with `triggerUIRefresh` to make sure whatever is displayed on screen is still up to date with the wrapper content.
 *
 * Also, to make sure that our wrapper is up to date, we schedule jobs to be run and fetch all contacts and update all the wrappers entries.
 * This is done in the
 *    - `ConfigurationSyncJob` (sending data to the network) and the
 *    - `ConfigurationSyncDumpJob` (just dumping locally the data)
 * with `insertAllContactsIntoContactsWrapper()`
 *
 */
const mappedContactWrapperValues = new Map<string, ContactInfo>();

/**
 * Update the ContactWrapper with all the data is cares about from the database.
 */
async function insertAllContactsIntoContactsWrapper() {
  const idsToInsert = getConversationController()
    .getConversations()
    .filter(isContactToStoreInWrapper)
    .map(m => m.id);

  window.log.debug(`ContactsWrapper keep tracks of ${idsToInsert.length} contacts: ${idsToInsert}`);

  for (let index = 0; index < idsToInsert.length; index++) {
    const id = idsToInsert[index];

    await insertContactFromDBIntoWrapperAndRefresh(id);
  }
}

/**
 * Returns true if that conversation is not us, is private, is not blinded.
 *
 * We want to sync the message request status so we need to allow a contact even if it's not approved, did not approve us and is not blocked.
 */
function isContactToStoreInWrapper(convo: ConversationModel): boolean {
  return (
    !convo.isMe() && convo.isPrivate() && convo.isActive() && !PubKey.hasBlindedPrefix(convo.id)
  );
}
// TODOLATER should we allow a blinded pubkey to be in the contact wrapper when we blocked it (can we block a blinded message request?)

/**
 * Fetches the specified convo and updates the required field in the wrapper.
 * If that contact does not exist in the wrapper, it is created before being updated.
 */
// tslint:disable-next-line: cyclomatic-complexity
async function insertContactFromDBIntoWrapperAndRefresh(id: string): Promise<void> {
  const foundConvo = getConversationController().get(id);
  if (!foundConvo) {
    return;
  }

  if (!isContactToStoreInWrapper(foundConvo)) {
    console.warn(
      `insertContactFromDBIntoWrapperAndRefresh: convo ${id} should not be saved. Skipping`
    );
    return;
  }

  const dbName = foundConvo.get('displayNameInProfile') || undefined;
  const dbNickname = foundConvo.get('nickname') || undefined;
  const dbProfileUrl = foundConvo.get('avatarPointer') || undefined;
  const dbProfileKey = foundConvo.get('profileKey') || undefined;
  const dbApproved = !!foundConvo.get('isApproved') || false;
  const dbApprovedMe = !!foundConvo.get('didApproveMe') || false;
  const dbBlocked = !!foundConvo.isBlocked() || false;
  const priority = foundConvo.get('priority') || 0;
  const expirationTimerSeconds = foundConvo.get('expireTimer') || 0;

  const wrapperContact = getContactInfoFromDBValues({
    id,
    dbApproved,
    dbApprovedMe,
    dbBlocked,
    dbName,
    dbNickname,
    dbProfileKey,
    dbProfileUrl,
    priority,
    expirationTimerSeconds,
  });

  try {
    await ContactsWrapperActions.set(wrapperContact);
  } catch (e) {
    window.log.warn(`ContactsWrapperActions.set of ${id} failed with ${e.message}`);
    // we still let this go through
  }

  await refreshMappedValue(id);
}

/**
 * @param duringAppStart set this to true if we should just fetch the cached value but not trigger a UI refresh of the corresponding conversation
 */
async function refreshMappedValue(id: string, duringAppStart = false) {
  const fromWrapper = await ContactsWrapperActions.get(id);

  if (fromWrapper) {
    setMappedValue(fromWrapper);
    if (!duringAppStart) {
      getConversationController()
        .get(id)
        ?.triggerUIRefresh();
    }
  } else {
    if (mappedContactWrapperValues.delete(id)) {
      if (!duringAppStart) {
        getConversationController()
          .get(id)
          ?.triggerUIRefresh();
      }
    }
  }
}

function setMappedValue(info: ContactInfo) {
  mappedContactWrapperValues.set(info.id, info);
}

function getContactCached(id: string) {
  return mappedContactWrapperValues.get(id);
}

async function removeContactFromWrapper(id: string) {
  try {
    await ContactsWrapperActions.erase(id);
  } catch (e) {
    window.log.warn(`ContactsWrapperActions.erase of ${id} failed with ${e.message}`);
  }
}
export const SessionUtilContact = {
  isContactToStoreInWrapper,
  insertAllContactsIntoContactsWrapper,
  insertContactFromDBIntoWrapperAndRefresh,
  removeContactFromWrapper,
  getContactCached,
  refreshMappedValue,
};
