// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual, isNumber } from 'lodash';
import Long from 'long';

import { deriveMasterKeyFromGroupV1 } from '../Crypto';
import * as Bytes from '../Bytes';
import dataInterface from '../sql/Client';
import {
  deriveGroupFields,
  waitThenMaybeUpdateGroup,
  waitThenRespondToGroupV2Migration,
} from '../groups';
import { assert } from '../util/assert';
import { normalizeUuid } from '../util/normalizeUuid';
import { missingCaseError } from '../util/missingCaseError';
import {
  PhoneNumberSharingMode,
  parsePhoneNumberSharingMode,
} from '../util/phoneNumberSharingMode';
import {
  PhoneNumberDiscoverability,
  parsePhoneNumberDiscoverability,
} from '../util/phoneNumberDiscoverability';
import { arePinnedConversationsEqual } from '../util/arePinnedConversationsEqual';
import type { ConversationModel } from '../models/conversations';
import {
  getSafeLongFromTimestamp,
  getTimestampFromLong,
} from '../util/timestampLongUtils';
import {
  get as getUniversalExpireTimer,
  set as setUniversalExpireTimer,
} from '../util/universalExpireTimer';
import { ourProfileKeyService } from './ourProfileKey';
import { isGroupV1, isGroupV2 } from '../util/whatTypeOfConversation';
import { isValidUuid } from '../types/UUID';
import type { ConversationAttributesType } from '../model-types.d';
import * as preferredReactionEmoji from '../reactions/preferredReactionEmoji';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { WhatIsThis } from '../window.d';

const { updateConversation } = dataInterface;

type RecordClass =
  | Proto.IAccountRecord
  | Proto.IContactRecord
  | Proto.IGroupV1Record
  | Proto.IGroupV2Record;

function toRecordVerified(verified: number): Proto.ContactRecord.IdentityState {
  const VERIFIED_ENUM = window.textsecure.storage.protocol.VerifiedStatus;
  const STATE_ENUM = Proto.ContactRecord.IdentityState;

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
    log.info(
      'storageService.addUnknownFields: Unknown fields found for',
      conversation.idForLogging()
    );
    conversation.set({
      storageUnknownFields: Bytes.toBase64(
        Bytes.concatenate(record.__unknownFields)
      ),
    });
  } else if (conversation.get('storageUnknownFields')) {
    // If the record doesn't have unknown fields attached but we have them
    // saved locally then we need to clear it out
    log.info(
      'storageService.addUnknownFields: Clearing unknown fields for',
      conversation.idForLogging()
    );
    conversation.unset('storageUnknownFields');
  }
}

function applyUnknownFields(
  record: RecordClass,
  conversation: ConversationModel
): void {
  const storageUnknownFields = conversation.get('storageUnknownFields');
  if (storageUnknownFields) {
    log.info(
      'storageService.applyUnknownFields: Applying unknown fields for',
      conversation.get('id')
    );
    // eslint-disable-next-line no-param-reassign
    record.__unknownFields = [Bytes.fromBase64(storageUnknownFields)];
  }
}

export async function toContactRecord(
  conversation: ConversationModel
): Promise<Proto.ContactRecord> {
  const contactRecord = new Proto.ContactRecord();
  const uuid = conversation.getUuid();
  if (uuid) {
    contactRecord.serviceUuid = uuid.toString();
  }
  const e164 = conversation.get('e164');
  if (e164) {
    contactRecord.serviceE164 = e164;
  }
  const profileKey = conversation.get('profileKey');
  if (profileKey) {
    contactRecord.profileKey = Bytes.fromBase64(String(profileKey));
  }

  const identityKey = uuid
    ? await window.textsecure.storage.protocol.loadIdentityKey(uuid)
    : undefined;
  if (identityKey) {
    contactRecord.identityKey = identityKey;
  }
  const verified = conversation.get('verified');
  if (verified) {
    contactRecord.identityState = toRecordVerified(Number(verified));
  }
  const profileName = conversation.get('profileName');
  if (profileName) {
    contactRecord.givenName = profileName;
  }
  const profileFamilyName = conversation.get('profileFamilyName');
  if (profileFamilyName) {
    contactRecord.familyName = profileFamilyName;
  }
  contactRecord.blocked = conversation.isBlocked();
  contactRecord.whitelisted = Boolean(conversation.get('profileSharing'));
  contactRecord.archived = Boolean(conversation.get('isArchived'));
  contactRecord.markedUnread = Boolean(conversation.get('markedUnread'));
  contactRecord.mutedUntilTimestamp = getSafeLongFromTimestamp(
    conversation.get('muteExpiresAt')
  );

  applyUnknownFields(contactRecord, conversation);

  return contactRecord;
}

export async function toAccountRecord(
  conversation: ConversationModel
): Promise<Proto.AccountRecord> {
  const accountRecord = new Proto.AccountRecord();

  if (conversation.get('profileKey')) {
    accountRecord.profileKey = Bytes.fromBase64(
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
  accountRecord.readReceipts = Boolean(window.Events.getReadReceiptSetting());
  accountRecord.sealedSenderIndicators = Boolean(
    window.storage.get('sealedSenderIndicators')
  );
  accountRecord.typingIndicators = Boolean(
    window.Events.getTypingIndicatorSetting()
  );
  accountRecord.linkPreviews = Boolean(window.Events.getLinkPreviewSetting());

  const primarySendsSms = window.storage.get('primarySendsSms');
  if (primarySendsSms !== undefined) {
    accountRecord.primarySendsSms = Boolean(primarySendsSms);
  }

  const accountE164 = window.storage.get('accountE164');
  if (accountE164 !== undefined) {
    accountRecord.e164 = accountE164;
  }

  const rawPreferredReactionEmoji = window.storage.get(
    'preferredReactionEmoji'
  );
  if (preferredReactionEmoji.canBeSynced(rawPreferredReactionEmoji)) {
    accountRecord.preferredReactionEmoji = rawPreferredReactionEmoji;
  }

  const universalExpireTimer = getUniversalExpireTimer();
  if (universalExpireTimer) {
    accountRecord.universalExpireTimer = Number(universalExpireTimer);
  }

  const PHONE_NUMBER_SHARING_MODE_ENUM =
    Proto.AccountRecord.PhoneNumberSharingMode;
  const phoneNumberSharingMode = parsePhoneNumberSharingMode(
    window.storage.get('phoneNumberSharingMode')
  );
  switch (phoneNumberSharingMode) {
    case PhoneNumberSharingMode.Everybody:
      accountRecord.phoneNumberSharingMode =
        PHONE_NUMBER_SHARING_MODE_ENUM.EVERYBODY;
      break;
    case PhoneNumberSharingMode.ContactsOnly:
      accountRecord.phoneNumberSharingMode =
        PHONE_NUMBER_SHARING_MODE_ENUM.CONTACTS_ONLY;
      break;
    case PhoneNumberSharingMode.Nobody:
      accountRecord.phoneNumberSharingMode =
        PHONE_NUMBER_SHARING_MODE_ENUM.NOBODY;
      break;
    default:
      throw missingCaseError(phoneNumberSharingMode);
  }

  const phoneNumberDiscoverability = parsePhoneNumberDiscoverability(
    window.storage.get('phoneNumberDiscoverability')
  );
  switch (phoneNumberDiscoverability) {
    case PhoneNumberDiscoverability.Discoverable:
      accountRecord.notDiscoverableByPhoneNumber = false;
      break;
    case PhoneNumberDiscoverability.NotDiscoverable:
      accountRecord.notDiscoverableByPhoneNumber = true;
      break;
    default:
      throw missingCaseError(phoneNumberDiscoverability);
  }

  const pinnedConversations = window.storage
    .get('pinnedConversationIds', new Array<string>())
    .map(id => {
      const pinnedConversation = window.ConversationController.get(id);

      if (pinnedConversation) {
        const pinnedConversationRecord =
          new Proto.AccountRecord.PinnedConversation();

        if (pinnedConversation.get('type') === 'private') {
          pinnedConversationRecord.identifier = 'contact';
          pinnedConversationRecord.contact = {
            uuid: pinnedConversation.get('uuid'),
            e164: pinnedConversation.get('e164'),
          };
        } else if (isGroupV1(pinnedConversation.attributes)) {
          pinnedConversationRecord.identifier = 'legacyGroupId';
          const groupId = pinnedConversation.get('groupId');
          if (!groupId) {
            throw new Error(
              'toAccountRecord: trying to pin a v1 Group without groupId'
            );
          }
          pinnedConversationRecord.legacyGroupId = Bytes.fromBinary(groupId);
        } else if (isGroupV2(pinnedConversation.attributes)) {
          pinnedConversationRecord.identifier = 'groupMasterKey';
          const masterKey = pinnedConversation.get('masterKey');
          if (!masterKey) {
            throw new Error(
              'toAccountRecord: trying to pin a v2 Group without masterKey'
            );
          }
          pinnedConversationRecord.groupMasterKey = Bytes.fromBase64(masterKey);
        }

        return pinnedConversationRecord;
      }

      return undefined;
    })
    .filter(
      (
        pinnedConversationClass
      ): pinnedConversationClass is Proto.AccountRecord.PinnedConversation =>
        pinnedConversationClass !== undefined
    );

  log.info(
    'storageService.toAccountRecord: pinnedConversations',
    pinnedConversations.length
  );

  accountRecord.pinnedConversations = pinnedConversations;

  const subscriberId = window.storage.get('subscriberId');
  if (subscriberId instanceof Uint8Array) {
    accountRecord.subscriberId = subscriberId;
  }
  const subscriberCurrencyCode = window.storage.get('subscriberCurrencyCode');
  if (typeof subscriberCurrencyCode === 'string') {
    accountRecord.subscriberCurrencyCode = subscriberCurrencyCode;
  }
  accountRecord.displayBadgesOnProfile = Boolean(
    window.storage.get('displayBadgesOnProfile')
  );

  applyUnknownFields(accountRecord, conversation);

  return accountRecord;
}

export async function toGroupV1Record(
  conversation: ConversationModel
): Promise<Proto.GroupV1Record> {
  const groupV1Record = new Proto.GroupV1Record();

  groupV1Record.id = Bytes.fromBinary(String(conversation.get('groupId')));
  groupV1Record.blocked = conversation.isBlocked();
  groupV1Record.whitelisted = Boolean(conversation.get('profileSharing'));
  groupV1Record.archived = Boolean(conversation.get('isArchived'));
  groupV1Record.markedUnread = Boolean(conversation.get('markedUnread'));
  groupV1Record.mutedUntilTimestamp = getSafeLongFromTimestamp(
    conversation.get('muteExpiresAt')
  );

  applyUnknownFields(groupV1Record, conversation);

  return groupV1Record;
}

export async function toGroupV2Record(
  conversation: ConversationModel
): Promise<Proto.GroupV2Record> {
  const groupV2Record = new Proto.GroupV2Record();

  const masterKey = conversation.get('masterKey');
  if (masterKey !== undefined) {
    groupV2Record.masterKey = Bytes.fromBase64(masterKey);
  }
  groupV2Record.blocked = conversation.isBlocked();
  groupV2Record.whitelisted = Boolean(conversation.get('profileSharing'));
  groupV2Record.archived = Boolean(conversation.get('isArchived'));
  groupV2Record.markedUnread = Boolean(conversation.get('markedUnread'));
  groupV2Record.mutedUntilTimestamp = getSafeLongFromTimestamp(
    conversation.get('muteExpiresAt')
  );
  groupV2Record.dontNotifyForMentionsIfMuted = Boolean(
    conversation.get('dontNotifyForMentionsIfMuted')
  );

  applyUnknownFields(groupV2Record, conversation);

  return groupV2Record;
}

type MessageRequestCapableRecord = Proto.IContactRecord | Proto.IGroupV1Record;

function applyMessageRequestState(
  record: MessageRequestCapableRecord,
  conversation: ConversationModel
): void {
  const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

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

  if (record.whitelisted === false) {
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
  const idForLogging = conversation.idForLogging();

  return Object.keys(remoteRecord).some((key: string): boolean => {
    const localValue = localRecord[key];
    const remoteValue = remoteRecord[key];

    // Sometimes we have a ByteBuffer and an Uint8Array, this ensures that we
    // are comparing them both equally by converting them into base64 string.
    if (localValue instanceof Uint8Array) {
      const areEqual = Bytes.areEqual(localValue, remoteValue);
      if (!areEqual) {
        log.info(
          'storageService.doRecordsConflict: Conflict found for Uint8Array',
          key,
          idForLogging
        );
      }
      return !areEqual;
    }

    // If both types are Long we can use Long's equals to compare them
    if (Long.isLong(localValue) || typeof localValue === 'number') {
      if (!Long.isLong(remoteValue) || typeof remoteValue !== 'number') {
        return true;
      }

      const areEqual = Long.fromValue(localValue).equals(
        Long.fromValue(remoteValue)
      );
      if (!areEqual) {
        log.info(
          'storageService.doRecordsConflict: Conflict found for Long',
          key,
          idForLogging
        );
      }
      return !areEqual;
    }

    if (key === 'pinnedConversations') {
      const areEqual = arePinnedConversationsEqual(localValue, remoteValue);
      if (!areEqual) {
        log.info(
          'storageService.doRecordsConflict: Conflict found for pinnedConversations',
          idForLogging
        );
      }
      return !areEqual;
    }

    if (localValue === remoteValue) {
      return false;
    }

    // Sometimes we get `null` values from Protobuf and they should default to
    // false, empty string, or 0 for these records we do not count them as
    // conflicting.
    if (
      remoteValue === null &&
      (localValue === false ||
        localValue === '' ||
        localValue === 0 ||
        (Long.isLong(localValue) && localValue.toNumber() === 0))
    ) {
      return false;
    }

    const areEqual = isEqual(localValue, remoteValue);

    if (!areEqual) {
      log.info(
        'storageService.doRecordsConflict: Conflict found for',
        key,
        idForLogging
      );
    }

    return !areEqual;
  });
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
  groupV1Record: Proto.IGroupV1Record
): Promise<boolean> {
  if (!groupV1Record.id) {
    throw new Error(`No ID for ${storageID}`);
  }

  const groupId = Bytes.toBinary(groupV1Record.id);

  // Attempt to fetch an existing group pertaining to the `groupId` or create
  // a new group and populate it with the attributes from the record.
  let conversation = window.ConversationController.get(groupId);

  // Because ConversationController.get retrieves all types of records we
  // may sometimes have a situation where we get a record of groupv1 type
  // where the binary representation of its ID matches a v2 record in memory.
  // Here we ensure that the record we're about to process is GV1 otherwise
  // we drop the update.
  if (conversation && !isGroupV1(conversation.attributes)) {
    throw new Error(
      `Record has group type mismatch ${conversation.idForLogging()}`
    );
  }

  if (!conversation) {
    // It's possible this group was migrated to a GV2 if so we attempt to
    // retrieve the master key and find the conversation locally. If we
    // are successful then we continue setting and applying state.
    const masterKeyBuffer = deriveMasterKeyFromGroupV1(groupV1Record.id);
    const fields = deriveGroupFields(masterKeyBuffer);
    const derivedGroupV2Id = Bytes.toBase64(fields.id);

    log.info(
      'storageService.mergeGroupV1Record: failed to find group by v1 id ' +
        `attempting lookup by v2 groupv2(${derivedGroupV2Id})`
    );
    conversation = window.ConversationController.get(derivedGroupV2Id);
  }
  if (conversation) {
    log.info(
      'storageService.mergeGroupV1Record: found existing group',
      conversation.idForLogging()
    );
  } else {
    if (groupV1Record.id.byteLength !== 16) {
      throw new Error('Not a valid gv1');
    }

    conversation = await window.ConversationController.getOrCreateAndWait(
      groupId,
      'group'
    );
    log.info(
      'storageService.mergeGroupV1Record: created a new group locally',
      conversation.idForLogging()
    );
  }

  conversation.set({
    isArchived: Boolean(groupV1Record.archived),
    markedUnread: Boolean(groupV1Record.markedUnread),
    storageID,
  });

  conversation.setMuteExpiration(
    getTimestampFromLong(groupV1Record.mutedUntilTimestamp),
    {
      viaStorageServiceSync: true,
    }
  );

  applyMessageRequestState(groupV1Record, conversation);

  let hasPendingChanges: boolean;

  if (isGroupV1(conversation.attributes)) {
    addUnknownFields(groupV1Record, conversation);

    hasPendingChanges = doesRecordHavePendingChanges(
      await toGroupV1Record(conversation),
      groupV1Record,
      conversation
    );
  } else {
    // We cannot preserve unknown fields if local group is V2 and the remote is
    // still V1, because the storageItem that we'll put into manifest will have
    // a different record type.
    log.info(
      'storageService.mergeGroupV1Record marking v1' +
        ' group for an update to v2',
      conversation.idForLogging()
    );

    // We want to upgrade group in the storage after merging it.
    hasPendingChanges = true;
  }

  updateConversation(conversation.attributes);

  return hasPendingChanges;
}

async function getGroupV2Conversation(
  masterKeyBuffer: Uint8Array
): Promise<ConversationModel> {
  const groupFields = deriveGroupFields(masterKeyBuffer);

  const groupId = Bytes.toBase64(groupFields.id);
  const masterKey = Bytes.toBase64(masterKeyBuffer);
  const secretParams = Bytes.toBase64(groupFields.secretParams);
  const publicParams = Bytes.toBase64(groupFields.publicParams);

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
  groupV2Record: Proto.IGroupV2Record
): Promise<boolean> {
  if (!groupV2Record.masterKey) {
    throw new Error(`No master key for ${storageID}`);
  }

  const masterKeyBuffer = groupV2Record.masterKey;
  const conversation = await getGroupV2Conversation(masterKeyBuffer);

  log.info('storageService.mergeGroupV2Record:', conversation.idForLogging());

  conversation.set({
    isArchived: Boolean(groupV2Record.archived),
    markedUnread: Boolean(groupV2Record.markedUnread),
    dontNotifyForMentionsIfMuted: Boolean(
      groupV2Record.dontNotifyForMentionsIfMuted
    ),
    storageID,
  });

  conversation.setMuteExpiration(
    getTimestampFromLong(groupV2Record.mutedUntilTimestamp),
    {
      viaStorageServiceSync: true,
    }
  );

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

  if (isGroupV1(conversation.attributes)) {
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
    waitThenMaybeUpdateGroup(
      {
        conversation,
        dropInitialJoinMessage,
      },
      { viaSync: true }
    );
  }

  return hasPendingChanges;
}

export async function mergeContactRecord(
  storageID: string,
  originalContactRecord: Proto.IContactRecord
): Promise<boolean> {
  const contactRecord = {
    ...originalContactRecord,

    serviceUuid: originalContactRecord.serviceUuid
      ? normalizeUuid(
          originalContactRecord.serviceUuid,
          'ContactRecord.serviceUuid'
        )
      : undefined,
  };

  const e164 = contactRecord.serviceE164 || undefined;
  const uuid = contactRecord.serviceUuid || undefined;

  // All contacts must have UUID
  if (!uuid) {
    return false;
  }

  if (!isValidUuid(uuid)) {
    return false;
  }

  const c = new window.Whisper.Conversation({
    e164,
    uuid,
    type: 'private',
  } as Partial<ConversationAttributesType> as WhatIsThis);

  const validationError = c.validate();
  if (validationError) {
    log.error(
      'storageService.mergeContactRecord: invalid contact',
      validationError
    );
    return false;
  }

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

  log.info('storageService.mergeContactRecord:', conversation.idForLogging());

  if (contactRecord.profileKey) {
    await conversation.setProfileKey(Bytes.toBase64(contactRecord.profileKey), {
      viaStorageServiceSync: true,
    });
  }

  const verified = await conversation.safeGetVerified();
  const storageServiceVerified = contactRecord.identityState || 0;
  if (verified !== storageServiceVerified) {
    const verifiedOptions = {
      key: contactRecord.identityKey,
      viaStorageServiceSync: true,
    };
    const STATE_ENUM = Proto.ContactRecord.IdentityState;

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

  conversation.setMuteExpiration(
    getTimestampFromLong(contactRecord.mutedUntilTimestamp),
    {
      viaStorageServiceSync: true,
    }
  );

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
  accountRecord: Proto.IAccountRecord
): Promise<boolean> {
  const {
    avatarUrl,
    linkPreviews,
    notDiscoverableByPhoneNumber,
    noteToSelfArchived,
    noteToSelfMarkedUnread,
    phoneNumberSharingMode,
    pinnedConversations,
    profileKey,
    readReceipts,
    sealedSenderIndicators,
    typingIndicators,
    primarySendsSms,
    universalExpireTimer,
    e164: accountE164,
    preferredReactionEmoji: rawPreferredReactionEmoji,
    subscriberId,
    subscriberCurrencyCode,
    displayBadgesOnProfile,
  } = accountRecord;

  window.storage.put('read-receipt-setting', Boolean(readReceipts));

  if (typeof sealedSenderIndicators === 'boolean') {
    window.storage.put('sealedSenderIndicators', sealedSenderIndicators);
  }

  if (typeof typingIndicators === 'boolean') {
    window.storage.put('typingIndicators', typingIndicators);
  }

  if (typeof linkPreviews === 'boolean') {
    window.storage.put('linkPreviews', linkPreviews);
  }

  if (typeof primarySendsSms === 'boolean') {
    window.storage.put('primarySendsSms', primarySendsSms);
  }

  if (typeof accountE164 === 'string' && accountE164) {
    window.storage.put('accountE164', accountE164);
    window.storage.user.setNumber(accountE164);
  }

  if (preferredReactionEmoji.canBeSynced(rawPreferredReactionEmoji)) {
    const localPreferredReactionEmoji =
      window.storage.get('preferredReactionEmoji') || [];
    if (!isEqual(localPreferredReactionEmoji, rawPreferredReactionEmoji)) {
      log.info(
        'storageService: remote and local preferredReactionEmoji do not match',
        localPreferredReactionEmoji.length,
        rawPreferredReactionEmoji.length
      );
    }
    window.storage.put('preferredReactionEmoji', rawPreferredReactionEmoji);
  }

  setUniversalExpireTimer(universalExpireTimer || 0);

  const PHONE_NUMBER_SHARING_MODE_ENUM =
    Proto.AccountRecord.PhoneNumberSharingMode;
  let phoneNumberSharingModeToStore: PhoneNumberSharingMode;
  switch (phoneNumberSharingMode) {
    case undefined:
    case null:
    case PHONE_NUMBER_SHARING_MODE_ENUM.EVERYBODY:
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.Everybody;
      break;
    case PHONE_NUMBER_SHARING_MODE_ENUM.CONTACTS_ONLY:
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.ContactsOnly;
      break;
    case PHONE_NUMBER_SHARING_MODE_ENUM.NOBODY:
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.Nobody;
      break;
    default:
      assert(
        false,
        `storageService.mergeAccountRecord: Got an unexpected phone number sharing mode: ${phoneNumberSharingMode}. Falling back to default`
      );
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.Everybody;
      break;
  }
  window.storage.put('phoneNumberSharingMode', phoneNumberSharingModeToStore);

  const discoverability = notDiscoverableByPhoneNumber
    ? PhoneNumberDiscoverability.NotDiscoverable
    : PhoneNumberDiscoverability.Discoverable;
  window.storage.put('phoneNumberDiscoverability', discoverability);

  if (profileKey) {
    ourProfileKeyService.set(profileKey);
  }

  if (pinnedConversations) {
    const modelPinnedConversations = window
      .getConversations()
      .filter(conversation => Boolean(conversation.get('isPinned')));

    const modelPinnedConversationIds = modelPinnedConversations.map(
      conversation => conversation.get('id')
    );

    const missingStoragePinnedConversationIds = window.storage
      .get('pinnedConversationIds', new Array<string>())
      .filter(id => !modelPinnedConversationIds.includes(id));

    if (missingStoragePinnedConversationIds.length !== 0) {
      log.info(
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

    log.info(
      'storageService.mergeAccountRecord: Local pinned',
      locallyPinnedConversations.length
    );
    log.info(
      'storageService.mergeAccountRecord: Remote pinned',
      pinnedConversations.length
    );

    const remotelyPinnedConversationPromises = pinnedConversations.map(
      async ({ contact, legacyGroupId, groupMasterKey }) => {
        let conversationId: string | undefined;

        if (contact) {
          conversationId =
            window.ConversationController.ensureContactIds(contact);
        } else if (legacyGroupId && legacyGroupId.length) {
          conversationId = Bytes.toBinary(legacyGroupId);
        } else if (groupMasterKey && groupMasterKey.length) {
          const groupFields = deriveGroupFields(groupMasterKey);
          const groupId = Bytes.toBase64(groupFields.id);

          conversationId = groupId;
        } else {
          log.error(
            'storageService.mergeAccountRecord: Invalid identifier received'
          );
        }

        if (!conversationId) {
          log.error(
            'storageService.mergeAccountRecord: missing conversation id.'
          );
          return undefined;
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

    log.info(
      'storageService.mergeAccountRecord: unpinning',
      conversationsToUnpin.length
    );

    log.info(
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

  if (subscriberId instanceof Uint8Array) {
    window.storage.put('subscriberId', subscriberId);
  }
  if (typeof subscriberCurrencyCode === 'string') {
    window.storage.put('subscriberCurrencyCode', subscriberCurrencyCode);
  }
  window.storage.put('displayBadgesOnProfile', Boolean(displayBadgesOnProfile));

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
    await conversation.setProfileKey(Bytes.toBase64(accountRecord.profileKey));
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
