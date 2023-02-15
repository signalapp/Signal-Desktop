import { isEmpty, isEqual } from 'lodash';
import { UserUtils } from '..';
import { ConversationModel } from '../../../models/conversation';
import { BlockedNumberController } from '../../../util';
import { ContactsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';
import { PubKey } from '../../types';
import { fromHexToArray } from '../String';

/**
 * Update the ContactWrapper with all the data is cares about from the database.
 */
async function insertAllContactsIntoContactsWrapper() {
  console.error(
    'we need to find a way to keep track of what was changed as ids and only insert those in the wrapper'
  );
  const idsToInsert = getConversationController()
    .getConversations()
    .filter(filterContactsToStoreInContactsWrapper)
    .map(m => m.id);

  window.log.debug(`ContactsWrapper keep tracks of ${idsToInsert.length} contacts`);

  for (let index = 0; index < idsToInsert.length; index++) {
    const id = idsToInsert[index];
    console.warn(`inserting into wrapper ${id}`);
    await insertContactFromDBIntoWrapper(id);
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
    !PubKey.hasBlindedPrefix(convo.id) &&
    (convo.isApproved() || convo.didApproveMe())
  );
}

/**
 * Fetches the specified convo and updates the required field in the wrapper.
 * If that contact does not exist in the wrapper, it is created before being updated.
 */
async function insertContactFromDBIntoWrapper(id: string): Promise<void> {
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

  const dbName = foundConvo.get('displayNameInProfile') || undefined;
  const dbNickname = foundConvo.get('nickname') || undefined;
  const dbProfileUrl = foundConvo.get('avatarPointer') || undefined;
  const dbProfileKey = foundConvo.get('profileKey') || undefined;
  const dbApproved = foundConvo.get('isApproved') || false;
  const dbApprovedMe = foundConvo.get('didApproveMe') || false;
  const dbBlocked = BlockedNumberController.isBlocked(id) || false;

  const wrapperContact = await ContactsWrapperActions.getOrCreate(id);

  // override the values with what we have in the DB. the library will do the diff
  wrapperContact.approved = dbApproved;
  wrapperContact.approvedMe = dbApprovedMe;
  wrapperContact.blocked = dbBlocked;
  wrapperContact.name = dbName;
  wrapperContact.nickname = dbNickname;

  if (
    wrapperContact.profilePicture?.url !== dbProfileUrl ||
    !isEqual(wrapperContact.profilePicture?.key, dbProfileKey)
  ) {
    wrapperContact.profilePicture = {
      url: dbProfileUrl || null,
      key: dbProfileKey && !isEmpty(dbProfileKey) ? fromHexToArray(dbProfileKey) : null,
    };
  }
  console.time('ContactsWrapperActions.set');
  await ContactsWrapperActions.set(wrapperContact);
  console.timeEnd('ContactsWrapperActions.set');
}

export const SessionUtilContact = {
  filterContactsToStoreInContactsWrapper,
  insertAllContactsIntoContactsWrapper,
};
