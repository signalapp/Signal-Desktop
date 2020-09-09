/* tslint:disable no-backbone-get-set-outside-model */
import { isEqual, isNumber } from 'lodash';

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  fromEncodedBinaryToArrayBuffer,
} from '../Crypto';
import dataInterface from '../sql/Client';
import {
  AccountRecordClass,
  ContactRecordClass,
  GroupV1RecordClass,
  GroupV2RecordClass,
} from '../textsecure.d';
import { deriveGroupFields, waitThenMaybeUpdateGroup } from '../groups';
import { ConversationModelType } from '../model-types.d';

const { updateConversation } = dataInterface;

type RecordClass =
  | AccountRecordClass
  | ContactRecordClass
  | GroupV1RecordClass
  | GroupV2RecordClass;

function toRecordVerified(verified: number): number {
  const VERIFIED_ENUM = window.textsecure.storage.protocol.VerifiedStatus;
  const STATE_ENUM = window.textsecure.protobuf.ContactRecord.IdentityState;

  switch (verified) {
    case VERIFIED_ENUM.VERIFIED:
      return STATE_ENUM.VERIFIED;
    case VERIFIED_ENUM.UNVERIFIED:
      return STATE_ENUM.UNVERIFIED;
    default:
      return STATE_ENUM.DEFAULT;
  }
}

function addUnknownFields(
  record: RecordClass,
  conversation: ConversationModelType
): void {
  if (record.__unknownFields) {
    conversation.set({
      storageUnknownFields: arrayBufferToBase64(record.__unknownFields),
    });
  }
}

function applyUnknownFields(
  record: RecordClass,
  conversation: ConversationModelType
): void {
  if (conversation.get('storageUnknownFields')) {
    // eslint-disable-next-line no-param-reassign
    record.__unknownFields = base64ToArrayBuffer(
      conversation.get('storageUnknownFields')
    );
  }
}

export async function toContactRecord(
  conversation: ConversationModelType
): Promise<ContactRecordClass> {
  const contactRecord = new window.textsecure.protobuf.ContactRecord();
  if (conversation.get('uuid')) {
    contactRecord.serviceUuid = conversation.get('uuid');
  }
  if (conversation.get('e164')) {
    contactRecord.serviceE164 = conversation.get('e164');
  }
  if (conversation.get('profileKey')) {
    contactRecord.profileKey = base64ToArrayBuffer(
      String(conversation.get('profileKey'))
    );
  }
  const identityKey = await window.textsecure.storage.protocol.loadIdentityKey(
    conversation.id
  );
  if (identityKey) {
    contactRecord.identityKey = identityKey;
  }
  if (conversation.get('verified')) {
    contactRecord.identityState = toRecordVerified(
      Number(conversation.get('verified'))
    );
  }
  if (conversation.get('profileName')) {
    contactRecord.givenName = conversation.get('profileName');
  }
  if (conversation.get('profileFamilyName')) {
    contactRecord.familyName = conversation.get('profileFamilyName');
  }
  contactRecord.blocked = conversation.isBlocked();
  contactRecord.whitelisted = Boolean(conversation.get('profileSharing'));
  contactRecord.archived = Boolean(conversation.get('isArchived'));

  applyUnknownFields(contactRecord, conversation);

  return contactRecord;
}

export async function toAccountRecord(
  conversation: ConversationModelType
): Promise<AccountRecordClass> {
  const accountRecord = new window.textsecure.protobuf.AccountRecord();

  if (conversation.get('profileKey')) {
    accountRecord.profileKey = base64ToArrayBuffer(
      String(conversation.get('profileKey'))
    );
  }
  if (conversation.get('profileName')) {
    accountRecord.givenName = conversation.get('profileName') || '';
  }
  if (conversation.get('profileFamilyName')) {
    accountRecord.familyName = conversation.get('profileFamilyName') || '';
  }
  accountRecord.avatarUrl = window.storage.get('avatarUrl') || '';
  accountRecord.noteToSelfArchived = Boolean(conversation.get('isArchived'));
  accountRecord.readReceipts = Boolean(
    window.storage.get('read-receipt-setting')
  );
  accountRecord.sealedSenderIndicators = Boolean(
    window.storage.get('sealedSenderIndicators')
  );
  accountRecord.typingIndicators = Boolean(
    window.storage.get('typingIndicators')
  );
  accountRecord.linkPreviews = Boolean(window.storage.get('linkPreviews'));

  applyUnknownFields(accountRecord, conversation);

  return accountRecord;
}

export async function toGroupV1Record(
  conversation: ConversationModelType
): Promise<GroupV1RecordClass> {
  const groupV1Record = new window.textsecure.protobuf.GroupV1Record();

  groupV1Record.id = fromEncodedBinaryToArrayBuffer(
    String(conversation.get('groupId'))
  );
  groupV1Record.blocked = conversation.isBlocked();
  groupV1Record.whitelisted = Boolean(conversation.get('profileSharing'));
  groupV1Record.archived = Boolean(conversation.get('isArchived'));

  applyUnknownFields(groupV1Record, conversation);

  return groupV1Record;
}

export async function toGroupV2Record(
  conversation: ConversationModelType
): Promise<GroupV2RecordClass> {
  const groupV2Record = new window.textsecure.protobuf.GroupV2Record();

  const masterKey = conversation.get('masterKey');
  if (masterKey !== undefined) {
    groupV2Record.masterKey = base64ToArrayBuffer(masterKey);
  }
  groupV2Record.blocked = conversation.isBlocked();
  groupV2Record.whitelisted = Boolean(conversation.get('profileSharing'));
  groupV2Record.archived = Boolean(conversation.get('isArchived'));

  applyUnknownFields(groupV2Record, conversation);

  return groupV2Record;
}

type MessageRequestCapableRecord = ContactRecordClass | GroupV1RecordClass;

function applyMessageRequestState(
  record: MessageRequestCapableRecord,
  conversation: ConversationModelType
): void {
  if (record.blocked) {
    conversation.applyMessageRequestResponse(
      conversation.messageRequestEnum.BLOCK,
      { fromSync: true, viaStorageServiceSync: true }
    );
  } else if (record.whitelisted) {
    // unblocking is also handled by this function which is why the next
    // condition is part of the else-if and not separate
    conversation.applyMessageRequestResponse(
      conversation.messageRequestEnum.ACCEPT,
      { fromSync: true, viaStorageServiceSync: true }
    );
  } else if (!record.blocked) {
    // if the condition above failed the state could still be blocked=false
    // in which case we should unblock the conversation
    conversation.unblock({ viaStorageServiceSync: true });
  }

  if (!record.whitelisted) {
    conversation.disableProfileSharing({ viaStorageServiceSync: true });
  }
}

function doesRecordHavePendingChanges(
  mergedRecord: RecordClass,
  serviceRecord: RecordClass,
  conversation: ConversationModelType
): boolean {
  const shouldSync = Boolean(conversation.get('needsStorageServiceSync'));

  const hasConflict = !isEqual(mergedRecord, serviceRecord);

  if (shouldSync && !hasConflict) {
    conversation.set({ needsStorageServiceSync: false });
  }

  return shouldSync && hasConflict;
}

export async function mergeGroupV1Record(
  storageID: string,
  groupV1Record: GroupV1RecordClass
): Promise<boolean> {
  window.log.info(`storageService.mergeGroupV1Record: merging ${storageID}`);

  if (!groupV1Record.id) {
    window.log.info(
      `storageService.mergeGroupV1Record: no ID for ${storageID}`
    );
    return false;
  }

  const groupId = groupV1Record.id.toBinary();

  // We do a get here because we don't get enough information from just this source to
  //   be able to do the right thing with this group. So we'll update the local group
  //   record if we have one; otherwise we'll just drop this update.
  const conversation = window.ConversationController.get(groupId);
  if (!conversation) {
    window.log.warn(
      `storageService.mergeGroupV1Record: No conversation for group(${groupId})`
    );
    return false;
  }

  conversation.set({
    isArchived: Boolean(groupV1Record.archived),
    storageID,
  });

  applyMessageRequestState(groupV1Record, conversation);

  addUnknownFields(groupV1Record, conversation);

  const hasPendingChanges = doesRecordHavePendingChanges(
    await toGroupV1Record(conversation),
    groupV1Record,
    conversation
  );

  updateConversation(conversation.attributes);

  window.log.info(`storageService.mergeGroupV1Record: merged ${storageID}`);

  return hasPendingChanges;
}

export async function mergeGroupV2Record(
  storageID: string,
  groupV2Record: GroupV2RecordClass
): Promise<boolean> {
  window.log.info(`storageService.mergeGroupV2Record: merging ${storageID}`);

  if (!groupV2Record.masterKey) {
    window.log.info(
      `storageService.mergeGroupV2Record: no master key for ${storageID}`
    );
    return false;
  }

  const masterKeyBuffer = groupV2Record.masterKey.toArrayBuffer();
  const groupFields = deriveGroupFields(masterKeyBuffer);

  const groupId = arrayBufferToBase64(groupFields.id);
  const masterKey = arrayBufferToBase64(masterKeyBuffer);
  const secretParams = arrayBufferToBase64(groupFields.secretParams);
  const publicParams = arrayBufferToBase64(groupFields.publicParams);

  const now = Date.now();
  const conversationId = window.ConversationController.ensureGroup(groupId, {
    // We want this conversation to show in the left pane when we first learn about it
    active_at: now,
    timestamp: now,
    // Basic GroupV2 data
    groupVersion: 2,
    masterKey,
    secretParams,
    publicParams,
  });
  const conversation = window.ConversationController.get(conversationId);

  if (!conversation) {
    throw new Error(
      `storageService.mergeGroupV2Record: No conversation for groupv2(${groupId})`
    );
  }

  conversation.maybeRepairGroupV2({
    masterKey,
    secretParams,
    publicParams,
  });

  conversation.set({
    isArchived: Boolean(groupV2Record.archived),
    storageID,
  });

  applyMessageRequestState(groupV2Record, conversation);

  addUnknownFields(groupV2Record, conversation);

  const hasPendingChanges = doesRecordHavePendingChanges(
    await toGroupV2Record(conversation),
    groupV2Record,
    conversation
  );

  updateConversation(conversation.attributes);

  const isFirstSync = !isNumber(window.storage.get('manifestVersion'));
  const dropInitialJoinMessage = isFirstSync;
  // tslint:disable-next-line no-floating-promises
  waitThenMaybeUpdateGroup({
    conversation,
    dropInitialJoinMessage,
  });
  window.log.info(`storageService.mergeGroupV2Record: merged ${storageID}`);

  return hasPendingChanges;
}

export async function mergeContactRecord(
  storageID: string,
  contactRecord: ContactRecordClass
): Promise<boolean> {
  window.log.info(`storageService.mergeContactRecord: merging ${storageID}`);

  window.normalizeUuids(
    contactRecord,
    ['serviceUuid'],
    'storageService.mergeContactRecord'
  );

  const e164 = contactRecord.serviceE164 || undefined;
  const uuid = contactRecord.serviceUuid || undefined;

  const id = window.ConversationController.ensureContactIds({
    e164,
    uuid,
    highTrust: true,
  });

  if (!id) {
    window.log.info(
      `storageService.mergeContactRecord: no ID for ${storageID}`
    );
    return false;
  }

  const conversation = await window.ConversationController.getOrCreateAndWait(
    id,
    'private'
  );

  if (contactRecord.profileKey) {
    await conversation.setProfileKey(
      arrayBufferToBase64(contactRecord.profileKey.toArrayBuffer()),
      { viaStorageServiceSync: true }
    );
  }

  const verified = await conversation.safeGetVerified();
  const storageServiceVerified = contactRecord.identityState || 0;
  if (verified !== storageServiceVerified) {
    const verifiedOptions = { viaStorageServiceSync: true };
    const STATE_ENUM = window.textsecure.protobuf.ContactRecord.IdentityState;

    switch (storageServiceVerified) {
      case STATE_ENUM.VERIFIED:
        await conversation.setVerified(verifiedOptions);
        break;
      case STATE_ENUM.UNVERIFIED:
        await conversation.setUnverified(verifiedOptions);
        break;
      default:
        await conversation.setVerifiedDefault(verifiedOptions);
    }
  }

  applyMessageRequestState(contactRecord, conversation);

  addUnknownFields(contactRecord, conversation);

  conversation.set({
    isArchived: Boolean(contactRecord.archived),
    storageID,
  });

  const hasPendingChanges = doesRecordHavePendingChanges(
    await toContactRecord(conversation),
    contactRecord,
    conversation
  );

  updateConversation(conversation.attributes);

  window.log.info(`storageService.mergeContactRecord: merged ${storageID}`);

  return hasPendingChanges;
}

export async function mergeAccountRecord(
  storageID: string,
  accountRecord: AccountRecordClass
): Promise<boolean> {
  window.log.info(`storageService.mergeAccountRecord: merging ${storageID}`);

  const {
    avatarUrl,
    linkPreviews,
    noteToSelfArchived,
    profileKey,
    readReceipts,
    sealedSenderIndicators,
    typingIndicators,
  } = accountRecord;

  window.storage.put('read-receipt-setting', readReceipts);

  if (typeof sealedSenderIndicators === 'boolean') {
    window.storage.put('sealedSenderIndicators', sealedSenderIndicators);
  }

  if (typeof typingIndicators === 'boolean') {
    window.storage.put('typingIndicators', typingIndicators);
  }

  if (typeof linkPreviews === 'boolean') {
    window.storage.put('linkPreviews', linkPreviews);
  }

  if (profileKey) {
    window.storage.put('profileKey', profileKey.toArrayBuffer());
  }

  window.log.info(
    `storageService.mergeAccountRecord: merged settings ${storageID}`
  );

  const ourID = window.ConversationController.getOurConversationId();

  if (!ourID) {
    return false;
  }

  const conversation = await window.ConversationController.getOrCreateAndWait(
    ourID,
    'private'
  );

  addUnknownFields(accountRecord, conversation);

  conversation.set({
    isArchived: Boolean(noteToSelfArchived),
    storageID,
  });

  if (accountRecord.profileKey) {
    await conversation.setProfileKey(
      arrayBufferToBase64(accountRecord.profileKey.toArrayBuffer())
    );
  }

  if (avatarUrl) {
    await conversation.setProfileAvatar(avatarUrl);
    window.storage.put('avatarUrl', avatarUrl);
  }

  const hasPendingChanges = doesRecordHavePendingChanges(
    await toAccountRecord(conversation),
    accountRecord,
    conversation
  );

  updateConversation(conversation.attributes);

  window.log.info(
    `storageService.mergeAccountRecord: merged profile ${storageID}`
  );

  return hasPendingChanges;
}
