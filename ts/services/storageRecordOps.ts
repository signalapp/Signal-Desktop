// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

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
  PinnedConversationClass,
} from '../textsecure.d';
import {
  deriveGroupFields,
  waitThenMaybeUpdateGroup,
  waitThenRespondToGroupV2Migration,
} from '../groups';
import { ConversationModel } from '../models/conversations';
import { ConversationAttributesTypeType } from '../model-types.d';

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
  conversation: ConversationModel
): void {
  if (record.__unknownFields) {
    window.log.info(
      'storageService.addUnknownFields: Unknown fields found for',
      conversation.debugID()
    );
    conversation.set({
      storageUnknownFields: arrayBufferToBase64(record.__unknownFields),
    });
  } else if (conversation.get('storageUnknownFields')) {
    // If the record doesn't have unknown fields attached but we have them
    // saved locally then we need to clear it out
    window.log.info(
      'storageService.addUnknownFields: Clearing unknown fields for',
      conversation.debugID()
    );
    conversation.unset('storageUnknownFields');
  }
}

function applyUnknownFields(
  record: RecordClass,
  conversation: ConversationModel
): void {
  if (conversation.get('storageUnknownFields')) {
    window.log.info(
      'storageService.applyUnknownFields: Applying unknown fields for',
      conversation.get('id')
    );
    // eslint-disable-next-line no-param-reassign
    record.__unknownFields = base64ToArrayBuffer(
      conversation.get('storageUnknownFields')
    );
  }
}

export async function toContactRecord(
  conversation: ConversationModel
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
  contactRecord.markedUnread = Boolean(conversation.get('markedUnread'));

  applyUnknownFields(contactRecord, conversation);

  return contactRecord;
}

export async function toAccountRecord(
  conversation: ConversationModel
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
  accountRecord.noteToSelfMarkedUnread = Boolean(
    conversation.get('markedUnread')
  );
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
  const pinnedConversations = window.storage
    .get<Array<string>>('pinnedConversationIds', [])
    .map(id => {
      const pinnedConversation = window.ConversationController.get(id);

      if (pinnedConversation) {
        const pinnedConversationRecord = new window.textsecure.protobuf.AccountRecord.PinnedConversation();

        if (pinnedConversation.get('type') === 'private') {
          pinnedConversationRecord.identifier = 'contact';
          pinnedConversationRecord.contact = {
            uuid: pinnedConversation.get('uuid'),
            e164: pinnedConversation.get('e164'),
          };
        } else if (pinnedConversation.isGroupV1()) {
          pinnedConversationRecord.identifier = 'legacyGroupId';
          const groupId = pinnedConversation.get('groupId');
          if (!groupId) {
            throw new Error(
              'toAccountRecord: trying to pin a v1 Group without groupId'
            );
          }
          pinnedConversationRecord.legacyGroupId = fromEncodedBinaryToArrayBuffer(
            groupId
          );
        } else if (pinnedConversation.isGroupV2()) {
          pinnedConversationRecord.identifier = 'groupMasterKey';
          const masterKey = pinnedConversation.get('masterKey');
          if (!masterKey) {
            throw new Error(
              'toAccountRecord: trying to pin a v2 Group without masterKey'
            );
          }
          pinnedConversationRecord.groupMasterKey = base64ToArrayBuffer(
            masterKey
          );
        }

        return pinnedConversationRecord;
      }

      return undefined;
    })
    .filter(
      (
        pinnedConversationClass
      ): pinnedConversationClass is PinnedConversationClass =>
        pinnedConversationClass !== undefined
    );

  window.log.info(
    `toAccountRecord: sending ${pinnedConversations.length} pinned conversations`
  );

  accountRecord.pinnedConversations = pinnedConversations;
  applyUnknownFields(accountRecord, conversation);

  return accountRecord;
}

export async function toGroupV1Record(
  conversation: ConversationModel
): Promise<GroupV1RecordClass> {
  const groupV1Record = new window.textsecure.protobuf.GroupV1Record();

  groupV1Record.id = fromEncodedBinaryToArrayBuffer(
    String(conversation.get('groupId'))
  );
  groupV1Record.blocked = conversation.isBlocked();
  groupV1Record.whitelisted = Boolean(conversation.get('profileSharing'));
  groupV1Record.archived = Boolean(conversation.get('isArchived'));
  groupV1Record.markedUnread = Boolean(conversation.get('markedUnread'));

  applyUnknownFields(groupV1Record, conversation);

  return groupV1Record;
}

export async function toGroupV2Record(
  conversation: ConversationModel
): Promise<GroupV2RecordClass> {
  const groupV2Record = new window.textsecure.protobuf.GroupV2Record();

  const masterKey = conversation.get('masterKey');
  if (masterKey !== undefined) {
    groupV2Record.masterKey = base64ToArrayBuffer(masterKey);
  }
  groupV2Record.blocked = conversation.isBlocked();
  groupV2Record.whitelisted = Boolean(conversation.get('profileSharing'));
  groupV2Record.archived = Boolean(conversation.get('isArchived'));
  groupV2Record.markedUnread = Boolean(conversation.get('markedUnread'));

  applyUnknownFields(groupV2Record, conversation);

  return groupV2Record;
}

type MessageRequestCapableRecord = ContactRecordClass | GroupV1RecordClass;

function applyMessageRequestState(
  record: MessageRequestCapableRecord,
  conversation: ConversationModel
): void {
  const messageRequestEnum =
    window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

  if (record.blocked) {
    conversation.applyMessageRequestResponse(messageRequestEnum.BLOCK, {
      fromSync: true,
      viaStorageServiceSync: true,
    });
  } else if (record.whitelisted) {
    // unblocking is also handled by this function which is why the next
    // condition is part of the else-if and not separate
    conversation.applyMessageRequestResponse(messageRequestEnum.ACCEPT, {
      fromSync: true,
      viaStorageServiceSync: true,
    });
  } else if (!record.blocked) {
    // if the condition above failed the state could still be blocked=false
    // in which case we should unblock the conversation
    conversation.unblock({ viaStorageServiceSync: true });
  }

  if (!record.whitelisted) {
    conversation.disableProfileSharing({ viaStorageServiceSync: true });
  }
}

type RecordClassObject = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function doRecordsConflict(
  localRecord: RecordClassObject,
  remoteRecord: RecordClassObject,
  conversation: ConversationModel
): boolean {
  const debugID = conversation.debugID();

  const localKeys = Object.keys(localRecord);
  const remoteKeys = Object.keys(remoteRecord);

  if (localKeys.length !== remoteKeys.length) {
    window.log.info(
      'storageService.doRecordsConflict: Local keys do not match remote keys',
      debugID,
      localKeys.join(','),
      remoteKeys.join(',')
    );
    return true;
  }

  return localKeys.reduce((hasConflict: boolean, key: string): boolean => {
    const localValue = localRecord[key];
    const remoteValue = remoteRecord[key];
    if (Object.prototype.toString.call(localValue) === '[object ArrayBuffer]') {
      const isEqual =
        arrayBufferToBase64(localValue) === arrayBufferToBase64(remoteValue);
      if (!isEqual) {
        window.log.info(
          'storageService.doRecordsConflict: Conflict found for',
          key,
          debugID
        );
      }
      return hasConflict || !isEqual;
    }

    if (localValue === remoteValue) {
      return hasConflict || false;
    }

    // Sometimes we get `null` values from Protobuf and they should default to
    // false, empty string, or 0 for these records we do not count them as
    // conflicting.
    if (
      remoteValue === null &&
      (localValue === false || localValue === '' || localValue === 0)
    ) {
      return hasConflict || false;
    }

    window.log.info(
      'storageService.doRecordsConflict: Conflict found for',
      key,
      debugID
    );
    return true;
  }, false);
}

function doesRecordHavePendingChanges(
  mergedRecord: RecordClass,
  serviceRecord: RecordClass,
  conversation: ConversationModel
): boolean {
  const shouldSync = Boolean(conversation.get('needsStorageServiceSync'));

  if (!shouldSync) {
    return false;
  }

  const hasConflict = doRecordsConflict(
    mergedRecord,
    serviceRecord,
    conversation
  );

  if (!hasConflict) {
    conversation.set({ needsStorageServiceSync: false });
  }

  return hasConflict;
}

export async function mergeGroupV1Record(
  storageID: string,
  groupV1Record: GroupV1RecordClass
): Promise<boolean> {
  if (!groupV1Record.id) {
    throw new Error(`No ID for ${storageID}`);
  }

  const groupId = groupV1Record.id.toBinary();

  // We do a get here because we don't get enough information from just this source to
  //   be able to do the right thing with this group. So we'll update the local group
  //   record if we have one; otherwise we'll just drop this update.
  const conversation = window.ConversationController.get(groupId);
  if (!conversation) {
    throw new Error(`No conversation for group(${groupId})`);
  }

  if (!conversation.isGroupV1()) {
    throw new Error(`Record has group type mismatch ${conversation.debugID()}`);
  }

  conversation.set({
    isArchived: Boolean(groupV1Record.archived),
    markedUnread: Boolean(groupV1Record.markedUnread),
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

  return hasPendingChanges;
}

async function getGroupV2Conversation(
  masterKeyBuffer: ArrayBuffer
): Promise<ConversationModel> {
  const groupFields = deriveGroupFields(masterKeyBuffer);

  const groupId = arrayBufferToBase64(groupFields.id);
  const masterKey = arrayBufferToBase64(masterKeyBuffer);
  const secretParams = arrayBufferToBase64(groupFields.secretParams);
  const publicParams = arrayBufferToBase64(groupFields.publicParams);

  // First we check for an existing GroupV2 group
  const groupV2 = window.ConversationController.get(groupId);
  if (groupV2) {
    await groupV2.maybeRepairGroupV2({
      masterKey,
      secretParams,
      publicParams,
    });

    return groupV2;
  }

  // Then check for V1 group with matching derived GV2 id
  const groupV1 = window.ConversationController.getByDerivedGroupV2Id(groupId);
  if (groupV1) {
    return groupV1;
  }

  const conversationId = window.ConversationController.ensureGroup(groupId, {
    // Note: We don't set active_at, because we don't want the group to show until
    //   we have information about it beyond these initial details.
    //   see maybeUpdateGroup().
    groupVersion: 2,
    masterKey,
    secretParams,
    publicParams,
  });
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error(
      `getGroupV2Conversation: Failed to create conversation for groupv2(${groupId})`
    );
  }

  return conversation;
}

export async function mergeGroupV2Record(
  storageID: string,
  groupV2Record: GroupV2RecordClass
): Promise<boolean> {
  if (!groupV2Record.masterKey) {
    throw new Error(`No master key for ${storageID}`);
  }

  const masterKeyBuffer = groupV2Record.masterKey.toArrayBuffer();
  const conversation = await getGroupV2Conversation(masterKeyBuffer);

  conversation.set({
    isArchived: Boolean(groupV2Record.archived),
    markedUnread: Boolean(groupV2Record.markedUnread),
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

  const isGroupNewToUs = !isNumber(conversation.get('revision'));
  const isFirstSync = !window.storage.get('storageFetchComplete');
  const dropInitialJoinMessage = isFirstSync;

  if (conversation.isGroupV1()) {
    // If we found a GroupV1 conversation from this incoming GroupV2 record, we need to
    //   migrate it!

    // We don't await this because this could take a very long time, waiting for queues to
    //   empty, etc.
    waitThenRespondToGroupV2Migration({
      conversation,
    });
  } else if (isGroupNewToUs) {
    // We don't need to update GroupV2 groups all the time. We fetch group state the first
    //   time we hear about these groups, from then on we rely on incoming messages or
    //   the user opening that conversation.

    // We don't await this because this could take a very long time, waiting for queues to
    //   empty, etc.
    waitThenMaybeUpdateGroup({
      conversation,
      dropInitialJoinMessage,
    });
  }

  return hasPendingChanges;
}

export async function mergeContactRecord(
  storageID: string,
  contactRecord: ContactRecordClass
): Promise<boolean> {
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
    throw new Error(`No ID for ${storageID}`);
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
    markedUnread: Boolean(contactRecord.markedUnread),
    storageID,
  });

  const hasPendingChanges = doesRecordHavePendingChanges(
    await toContactRecord(conversation),
    contactRecord,
    conversation
  );

  updateConversation(conversation.attributes);

  return hasPendingChanges;
}

export async function mergeAccountRecord(
  storageID: string,
  accountRecord: AccountRecordClass
): Promise<boolean> {
  const {
    avatarUrl,
    linkPreviews,
    noteToSelfArchived,
    noteToSelfMarkedUnread,
    pinnedConversations: remotelyPinnedConversationClasses,
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

  if (remotelyPinnedConversationClasses) {
    const modelPinnedConversations = window
      .getConversations()
      .filter(conversation => Boolean(conversation.get('isPinned')));

    const modelPinnedConversationIds = modelPinnedConversations.map(
      conversation => conversation.get('id')
    );

    const missingStoragePinnedConversationIds = window.storage
      .get<Array<string>>('pinnedConversationIds', [])
      .filter(id => !modelPinnedConversationIds.includes(id));

    if (missingStoragePinnedConversationIds.length !== 0) {
      window.log.info(
        'mergeAccountRecord: pinnedConversationIds in storage does not match pinned Conversation models'
      );
    }

    const locallyPinnedConversations = modelPinnedConversations.concat(
      missingStoragePinnedConversationIds
        .map(conversationId =>
          window.ConversationController.get(conversationId)
        )
        .filter(
          (conversation): conversation is ConversationModel =>
            conversation !== undefined
        )
    );

    window.log.info(
      'storageService.mergeAccountRecord: Local pinned',
      locallyPinnedConversations.length
    );

    const remotelyPinnedConversationPromises = remotelyPinnedConversationClasses.map(
      async pinnedConversation => {
        let conversationId;
        let conversationType: ConversationAttributesTypeType = 'private';

        switch (pinnedConversation.identifier) {
          case 'contact': {
            if (!pinnedConversation.contact) {
              throw new Error('mergeAccountRecord: no contact found');
            }
            conversationId = window.ConversationController.ensureContactIds(
              pinnedConversation.contact
            );
            conversationType = 'private';
            break;
          }
          case 'legacyGroupId': {
            if (!pinnedConversation.legacyGroupId) {
              throw new Error('mergeAccountRecord: no legacyGroupId found');
            }
            conversationId = pinnedConversation.legacyGroupId.toBinary();
            conversationType = 'group';
            break;
          }
          case 'groupMasterKey': {
            if (!pinnedConversation.groupMasterKey) {
              throw new Error('mergeAccountRecord: no groupMasterKey found');
            }
            const masterKeyBuffer = pinnedConversation.groupMasterKey.toArrayBuffer();
            const groupFields = deriveGroupFields(masterKeyBuffer);
            const groupId = arrayBufferToBase64(groupFields.id);

            conversationId = groupId;
            conversationType = 'group';
            break;
          }
          default: {
            window.log.error(
              'storageService.mergeAccountRecord: Invalid identifier received'
            );
          }
        }

        if (!conversationId) {
          window.log.error(
            'storageService.mergeAccountRecord: missing conversation id. looking based on',
            pinnedConversation.identifier
          );
          return undefined;
        }

        if (conversationType === 'private') {
          return window.ConversationController.getOrCreateAndWait(
            conversationId,
            conversationType
          );
        }

        return window.ConversationController.get(conversationId);
      }
    );

    const remotelyPinnedConversations = (
      await Promise.all(remotelyPinnedConversationPromises)
    ).filter(
      (conversation): conversation is ConversationModel =>
        conversation !== undefined
    );

    const remotelyPinnedConversationIds = remotelyPinnedConversations.map(
      ({ id }) => id
    );

    const conversationsToUnpin = locallyPinnedConversations.filter(
      ({ id }) => !remotelyPinnedConversationIds.includes(id)
    );

    window.log.info(
      'storageService.mergeAccountRecord: unpinning',
      conversationsToUnpin.length
    );

    window.log.info(
      'storageService.mergeAccountRecord: pinning',
      remotelyPinnedConversations.length
    );

    conversationsToUnpin.forEach(conversation => {
      conversation.set({ isPinned: false });
      updateConversation(conversation.attributes);
    });

    remotelyPinnedConversations.forEach(conversation => {
      conversation.set({ isPinned: true, isArchived: false });
      updateConversation(conversation.attributes);
    });

    window.storage.put('pinnedConversationIds', remotelyPinnedConversationIds);
  }

  const ourID = window.ConversationController.getOurConversationId();

  if (!ourID) {
    throw new Error('Could not find ourID');
  }

  const conversation = await window.ConversationController.getOrCreateAndWait(
    ourID,
    'private'
  );

  addUnknownFields(accountRecord, conversation);

  conversation.set({
    isArchived: Boolean(noteToSelfArchived),
    markedUnread: Boolean(noteToSelfMarkedUnread),
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

  return hasPendingChanges;
}
