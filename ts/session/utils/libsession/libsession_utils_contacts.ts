import { isEmpty, isEqual } from 'lodash';
import { UserUtils } from '..';
import { ConversationModel } from '../../../models/conversation';
import { ContactsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';
import { PubKey } from '../../types';
import { fromHexToArray } from '../String';
import { ContactInfo } from 'session_util_wrapper';

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
    .filter(filterContactsToStoreInContactsWrapper)
    .map(m => m.id);

  window.log.debug(`ContactsWrapper keep tracks of ${idsToInsert.length} contacts`);

  for (let index = 0; index < idsToInsert.length; index++) {
    const id = idsToInsert[index];
    console.warn(
      `inserting into wrapper ${id}: ${getConversationController().get(id)?.attributes.nickname}`
    );
    await insertContactFromDBIntoWrapperAndRefresh(id);
  }
}

/**
 * Returns true if that conversation is not us, is private, is not blinded and has either the
 * `isApproved` or `didApproveMe` field set.
 * So that would be all the private conversations we either sent or receive a message from, not blinded
 */
function filterContactsToStoreInContactsWrapper(convo: ConversationModel): boolean {
  return (
    !convo.isMe() &&
    convo.isPrivate() &&
    convo.isActive() &&
    !PubKey.hasBlindedPrefix(convo.id) &&
    (convo.isApproved() || convo.didApproveMe())
  );
}

/**
 * Fetches the specified convo and updates the required field in the wrapper.
 * If that contact does not exist in the wrapper, it is created before being updated.
 */
// tslint:disable-next-line: cyclomatic-complexity
async function insertContactFromDBIntoWrapperAndRefresh(id: string): Promise<void> {
  const us = UserUtils.getOurPubKeyStrFromCache();
  if (id === us) {
    window.log.info(
      "The contact config wrapper does not handle the current user config, just his contacts'"
    );
    return;
  }

  const foundConvo = getConversationController().get(id);
  if (!foundConvo) {
    return;
  }

  if (!filterContactsToStoreInContactsWrapper(foundConvo)) {
    window.log.info(`insertContactFromDBIntoWrapperAndRefresh: convo ${id} should not be saved`);
    return;
  }

  console.time(`ContactsWrapperActions.set ${id}`);

  const dbName = foundConvo.get('displayNameInProfile') || undefined;
  const dbNickname = foundConvo.get('nickname') || undefined;
  const dbProfileUrl = foundConvo.get('avatarPointer') || undefined;
  const dbProfileKey = foundConvo.get('profileKey') || undefined;
  const dbApproved = !!foundConvo.get('isApproved') || false;
  const dbApprovedMe = !!foundConvo.get('didApproveMe') || false;
  const dbBlocked = !!foundConvo.isBlocked() || false;

  const wrapperContact = await ContactsWrapperActions.getOrCreate(id);
  const activeAt = foundConvo.get('active_at');
  const isPinned = foundConvo.get('isPinned');

  // override the values with what we have in the DB. the library will do the diff
  wrapperContact.approved = dbApproved;
  wrapperContact.approvedMe = dbApprovedMe;
  wrapperContact.blocked = dbBlocked;
  wrapperContact.name = dbName;
  wrapperContact.nickname = dbNickname;
  wrapperContact.hidden = !activeAt || activeAt <= 0;
  wrapperContact.priority = !!isPinned ? 1 : 0; // TODO the priority handling is not that simple

  if (
    wrapperContact.profilePicture?.url !== dbProfileUrl ||
    !isEqual(wrapperContact.profilePicture?.key, dbProfileKey)
  ) {
    wrapperContact.profilePicture = {
      url: dbProfileUrl || null,
      key: dbProfileKey && !isEmpty(dbProfileKey) ? fromHexToArray(dbProfileKey) : null,
    };
  }
  await ContactsWrapperActions.set(wrapperContact);

  await refreshMappedValue(id);

  console.timeEnd(`ContactsWrapperActions.set ${id}`);
}

async function refreshMappedValue(id: string, duringAppStart = false) {
  const fromWrapper = await ContactsWrapperActions.get(id);
  if (fromWrapper) {
    SessionUtilContact.setMappedValue(fromWrapper);
    if (!duringAppStart) {
      getConversationController()
        .get(id)
        ?.triggerUIRefresh();
    }
  }
}

function setMappedValue(info: ContactInfo) {
  mappedContactWrapperValues.set(info.id, info);
}

function getMappedValue(id: string) {
  return mappedContactWrapperValues.get(id);
}

function removeMappedValue(id: string) {
  mappedContactWrapperValues.delete(id);
}

export const SessionUtilContact = {
  filterContactsToStoreInContactsWrapper,
  insertAllContactsIntoContactsWrapper,
  insertContactFromDBIntoWrapperAndRefresh,
  setMappedValue,
  getMappedValue,
  removeMappedValue,
  refreshMappedValue,
};
