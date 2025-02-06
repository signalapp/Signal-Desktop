// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, isNumber, chunk } from 'lodash';
import pMap from 'p-map';
import Long from 'long';

import { DataReader, DataWriter } from '../sql/Client';
import * as Bytes from '../Bytes';
import {
  getRandomBytes,
  deriveStorageItemKey,
  deriveStorageManifestKey,
  encryptProfile,
  decryptProfile,
  deriveMasterKeyFromGroupV1,
  deriveStorageServiceKey,
} from '../Crypto';
import {
  mergeAccountRecord,
  mergeContactRecord,
  mergeGroupV1Record,
  mergeGroupV2Record,
  mergeStoryDistributionListRecord,
  mergeStickerPackRecord,
  toAccountRecord,
  toContactRecord,
  toGroupV1Record,
  toGroupV2Record,
  toStoryDistributionListRecord,
  toStickerPackRecord,
  toCallLinkRecord,
  mergeCallLinkRecord,
  toDefunctOrPendingCallLinkRecord,
} from './storageRecordOps';
import type { MergeResultType } from './storageRecordOps';
import { MAX_READ_KEYS } from './storageConstants';
import type { ConversationModel } from '../models/conversations';
import { strictAssert } from '../util/assert';
import { drop } from '../util/drop';
import { dropNull } from '../util/dropNull';
import * as durations from '../util/durations';
import { BackOff } from '../util/BackOff';
import { storageJobQueue } from '../util/JobQueue';
import { sleep } from '../util/sleep';
import { isMoreRecentThan, isOlderThan } from '../util/timestamp';
import { map, filter } from '../util/iterables';
import { getMessageQueueTime } from '../util/getMessageQueueTime';
import { ourProfileKeyService } from './ourProfileKey';
import {
  ConversationTypes,
  isDirectConversation,
  typeofConversation,
} from '../util/whatTypeOfConversation';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import * as Errors from '../types/errors';
import type {
  ExtendedStorageID,
  RemoteRecord,
  UnknownRecord,
} from '../types/StorageService.d';
import MessageSender from '../textsecure/SendMessage';
import type {
  StoryDistributionWithMembersType,
  StorageServiceFieldsType,
  StickerPackType,
  UninstalledStickerPackType,
} from '../sql/Interface';
import { MY_STORY_ID } from '../types/Stories';
import { isNotNil } from '../util/isNotNil';
import { isSignalConversation } from '../util/isSignalConversation';
import { redactExtendedStorageID, redactStorageID } from '../util/privacy';
import type {
  CallLinkRecord,
  DefunctCallLinkType,
  PendingCallLinkType,
} from '../types/CallLink';
import {
  callLinkFromRecord,
  getRoomIdFromRootKeyString,
} from '../util/callLinksRingrtc';
import { callLinkRefreshJobQueue } from '../jobs/callLinkRefreshJobQueue';

type IManifestRecordIdentifier = Proto.ManifestRecord.IIdentifier;

const { getItemById } = DataReader;

const {
  eraseStorageServiceState,
  flushUpdateConversationBatcher,
  updateConversation,
  updateConversations,
} = DataWriter;

const uploadBucket: Array<number> = [];

const validRecordTypes = new Set([
  0, // UNKNOWN
  1, // CONTACT
  2, // GROUPV1
  3, // GROUPV2
  4, // ACCOUNT
  5, // STORY_DISTRIBUTION_LIST
  6, // STICKER_PACK
  7, // CALL_LINK
]);

const backOff = new BackOff([
  durations.SECOND,
  5 * durations.SECOND,
  30 * durations.SECOND,
  2 * durations.MINUTE,
  5 * durations.MINUTE,
]);

const conflictBackOff = new BackOff([
  durations.SECOND,
  5 * durations.SECOND,
  30 * durations.SECOND,
]);

function encryptRecord(
  storageID: string | undefined,
  recordIkm: Uint8Array | undefined,
  storageRecord: Proto.IStorageRecord
): Proto.StorageItem {
  const storageItem = new Proto.StorageItem();

  const storageKeyBuffer = storageID
    ? Bytes.fromBase64(storageID)
    : generateStorageID();

  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const storageServiceKey = Bytes.fromBase64(storageKeyBase64);
  const storageItemKey = deriveStorageItemKey({
    storageServiceKey,
    recordIkm,
    key: storageKeyBuffer,
  });

  const encryptedRecord = encryptProfile(
    Proto.StorageRecord.encode(storageRecord).finish(),
    storageItemKey
  );

  storageItem.key = storageKeyBuffer;
  storageItem.value = encryptedRecord;

  return storageItem;
}

function generateStorageID(): Uint8Array {
  return getRandomBytes(16);
}

type GeneratedManifestType = {
  postUploadUpdateFunctions: Array<() => unknown>;
  recordIkm: Uint8Array | undefined;
  recordsByID: Map<string, MergeableItemType | RemoteRecord>;
  insertKeys: Set<string>;
  deleteKeys: Set<string>;
};

async function generateManifest(
  version: number,
  previousManifest?: Proto.IManifestRecord,
  isNewManifest = false
): Promise<GeneratedManifestType> {
  log.info(
    `storageService.upload(${version}): generating manifest ` +
      `new=${isNewManifest}`
  );

  await window.ConversationController.checkForConflicts();

  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;

  const postUploadUpdateFunctions: Array<() => unknown> = [];
  const insertKeys = new Set<string>();
  const deleteKeys = new Set<string>();
  const recordsByID = new Map<string, MergeableItemType | RemoteRecord>();

  function processStorageRecord({
    conversation,
    currentStorageID,
    currentStorageVersion,
    identifierType,
    storageNeedsSync,
    storageRecord,
  }: {
    conversation?: ConversationModel;
    currentStorageID?: string;
    currentStorageVersion?: number;
    identifierType: Proto.ManifestRecord.Identifier.Type;
    storageNeedsSync: boolean;
    storageRecord: Proto.IStorageRecord;
  }) {
    const currentRedactedID = currentStorageID
      ? redactStorageID(currentStorageID, currentStorageVersion)
      : undefined;

    const isNewItem = isNewManifest || storageNeedsSync || !currentStorageID;

    const storageID = isNewItem
      ? Bytes.toBase64(generateStorageID())
      : currentStorageID;

    recordsByID.set(storageID, {
      itemType: identifierType,
      storageID,
      storageRecord,
    });

    // When a client needs to update a given record it should create it
    // under a new key and delete the existing key.
    if (isNewItem) {
      insertKeys.add(storageID);
      const newRedactedID = redactStorageID(storageID, version, conversation);
      if (currentStorageID) {
        log.info(
          `storageService.upload(${version}): ` +
            `updating from=${currentRedactedID} ` +
            `to=${newRedactedID}`
        );
        deleteKeys.add(currentStorageID);
      } else {
        log.info(
          `storageService.upload(${version}): adding key=${newRedactedID}`
        );
      }
    }

    return {
      isNewItem,
      storageID,
    };
  }

  const conversations = window.getConversations();
  for (let i = 0; i < conversations.length; i += 1) {
    const conversation = conversations.models[i];

    let identifierType;
    let storageRecord;

    if (isSignalConversation(conversation.attributes)) {
      continue;
    }

    const conversationType = typeofConversation(conversation.attributes);
    if (conversationType === ConversationTypes.Me) {
      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.account = await toAccountRecord(conversation);
      identifierType = ITEM_TYPE.ACCOUNT;
    } else if (conversationType === ConversationTypes.Direct) {
      // Contacts must have UUID
      if (!conversation.getServiceId()) {
        continue;
      }

      let shouldDrop = false;
      let dropReason: string | undefined;

      const validationError = conversation.validate();
      if (validationError) {
        shouldDrop = true;
        dropReason = `local validation error=${validationError}`;
      } else if (conversation.isUnregisteredAndStale()) {
        shouldDrop = true;
        dropReason = 'unregistered and stale';
      }

      if (shouldDrop) {
        const droppedID = conversation.get('storageID');
        const droppedVersion = conversation.get('storageVersion');
        if (!droppedID) {
          continue;
        }

        const recordID = redactStorageID(
          droppedID,
          droppedVersion,
          conversation
        );

        log.warn(
          `storageService.generateManifest(${version}): ` +
            `dropping contact=${recordID} ` +
            `due to ${dropReason}`
        );
        conversation.unset('storageID');
        deleteKeys.add(droppedID);
        continue;
      }

      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.contact = await toContactRecord(conversation);
      identifierType = ITEM_TYPE.CONTACT;
    } else if (conversationType === ConversationTypes.GroupV2) {
      storageRecord = new Proto.StorageRecord();
      storageRecord.groupV2 = toGroupV2Record(conversation);
      identifierType = ITEM_TYPE.GROUPV2;
    } else if (conversationType === ConversationTypes.GroupV1) {
      storageRecord = new Proto.StorageRecord();
      storageRecord.groupV1 = toGroupV1Record(conversation);
      identifierType = ITEM_TYPE.GROUPV1;
    } else {
      log.warn(
        `storageService.upload(${version}): ` +
          `unknown conversation=${conversation.idForLogging()}`
      );
    }

    if (!storageRecord || !identifierType) {
      continue;
    }

    const { isNewItem, storageID } = processStorageRecord({
      conversation,
      currentStorageID: conversation.get('storageID'),
      currentStorageVersion: conversation.get('storageVersion'),
      identifierType,
      storageNeedsSync: Boolean(conversation.get('needsStorageServiceSync')),
      storageRecord,
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        conversation.set({
          needsStorageServiceSync: false,
          storageVersion: version,
          storageID,
        });
        drop(updateConversation(conversation.attributes));
      });
    }
  }

  const {
    callLinkDbRecords,
    defunctCallLinks,
    pendingCallLinks,
    storyDistributionLists,
    installedStickerPacks,
    uninstalledStickerPacks,
  } = await getNonConversationRecords();

  log.info(
    `storageService.upload(${version}): ` +
      `adding storyDistributionLists=${storyDistributionLists.length}`
  );

  for (const storyDistributionList of storyDistributionLists) {
    const storageRecord = new Proto.StorageRecord();
    storageRecord.storyDistributionList = toStoryDistributionListRecord(
      storyDistributionList
    );

    if (
      storyDistributionList.deletedAtTimestamp != null &&
      isOlderThan(
        storyDistributionList.deletedAtTimestamp,
        getMessageQueueTime()
      )
    ) {
      const droppedID = storyDistributionList.storageID;
      const droppedVersion = storyDistributionList.storageVersion;
      if (!droppedID) {
        continue;
      }

      const recordID = redactStorageID(droppedID, droppedVersion);

      log.warn(
        `storageService.generateManifest(${version}): ` +
          `dropping storyDistributionList=${recordID} ` +
          `due to expired deleted timestamp=${storyDistributionList.deletedAtTimestamp}`
      );
      deleteKeys.add(droppedID);

      drop(DataWriter.deleteStoryDistribution(storyDistributionList.id));
      continue;
    }

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: storyDistributionList.storageID,
      currentStorageVersion: storyDistributionList.storageVersion,
      identifierType: ITEM_TYPE.STORY_DISTRIBUTION_LIST,
      storageNeedsSync: storyDistributionList.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        void DataWriter.modifyStoryDistribution({
          ...storyDistributionList,
          storageID,
          storageVersion: version,
          storageNeedsSync: false,
        });
      });
    }
  }

  const uninstalledStickerPackIds = new Set<string>();

  let newlyUninstalledPacks = 0;
  uninstalledStickerPacks.forEach(stickerPack => {
    const storageRecord = new Proto.StorageRecord();
    storageRecord.stickerPack = toStickerPackRecord(stickerPack);

    uninstalledStickerPackIds.add(stickerPack.id);

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: stickerPack.storageID,
      currentStorageVersion: stickerPack.storageVersion,
      identifierType: ITEM_TYPE.STICKER_PACK,
      storageNeedsSync: stickerPack.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      newlyUninstalledPacks += 1;
      postUploadUpdateFunctions.push(() =>
        DataWriter.addUninstalledStickerPack({
          ...stickerPack,
          storageID,
          storageVersion: version,
          storageNeedsSync: false,
        })
      );
    }
  });

  let newlyInstalledPacks = 0;
  installedStickerPacks.forEach(stickerPack => {
    if (uninstalledStickerPackIds.has(stickerPack.id)) {
      log.error(
        `storageService.upload(${version}): ` +
          `sticker pack ${stickerPack.id} is both installed and uninstalled`
      );
      window.reduxActions.stickers.uninstallStickerPack(
        stickerPack.id,
        stickerPack.key,
        { actionSource: 'storageService' }
      );
      return;
    }

    const storageRecord = new Proto.StorageRecord();
    storageRecord.stickerPack = toStickerPackRecord(stickerPack);

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: stickerPack.storageID,
      currentStorageVersion: stickerPack.storageVersion,
      identifierType: ITEM_TYPE.STICKER_PACK,
      storageNeedsSync: stickerPack.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      newlyInstalledPacks += 1;
      postUploadUpdateFunctions.push(() =>
        DataWriter.updateStickerPackInfo({
          id: stickerPack.id,
          key: stickerPack.key,

          storageID,
          storageVersion: version,
          storageNeedsSync: false,
          position: stickerPack.position,
        })
      );
    }
  });

  log.info(
    `storageService.upload(${version}): stickerPacks ` +
      `installed=${newlyInstalledPacks}/${installedStickerPacks.length} ` +
      `uninstalled=${newlyUninstalledPacks}/${uninstalledStickerPacks.length}`
  );

  log.info(
    `storageService.upload(${version}): ` +
      `adding callLinks=${callLinkDbRecords.length}`
  );

  const callLinkRoomIds = new Set<string>();

  for (const callLinkDbRecord of callLinkDbRecords) {
    const { roomId } = callLinkDbRecord;
    if (callLinkDbRecord.adminKey == null || callLinkDbRecord.rootKey == null) {
      log.warn(
        `storageService.upload(${version}): ` +
          `call link ${roomId} has empty rootKey`
      );
      continue;
    }

    const storageRecord = new Proto.StorageRecord();
    storageRecord.callLink = toCallLinkRecord(callLinkDbRecord);
    const callLink = callLinkFromRecord(callLinkDbRecord);

    callLinkRoomIds.add(callLink.roomId);

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: callLink.storageID,
      currentStorageVersion: callLink.storageVersion,
      identifierType: ITEM_TYPE.CALL_LINK,
      storageNeedsSync: callLink.storageNeedsSync,
      storageRecord,
    });

    const storageFields = {
      storageID,
      storageVersion: version,
      storageNeedsSync: false,
    };

    if (isNewItem) {
      postUploadUpdateFunctions.push(async () => {
        const freshCallLink = await DataReader.getCallLinkByRoomId(roomId);
        if (freshCallLink == null) {
          log.warn(
            `storageService.upload(${version}): ` +
              `call link ${roomId} removed locally from DB while we were uploading to storage`
          );
          return;
        }

        const callLinkToSave = { ...freshCallLink, ...storageFields };
        await DataWriter.updateCallLink(callLinkToSave);
        window.reduxActions.calling.handleCallLinkUpdateLocal(callLinkToSave);
      });
    }
  }

  log.info(
    `storageService.upload(${version}): ` +
      `adding defunctCallLinks=${defunctCallLinks.length}`
  );

  defunctCallLinks.forEach(defunctCallLink => {
    const storageRecord = new Proto.StorageRecord();
    storageRecord.callLink = toDefunctOrPendingCallLinkRecord(defunctCallLink);

    callLinkRoomIds.add(defunctCallLink.roomId);

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: defunctCallLink.storageID,
      currentStorageVersion: defunctCallLink.storageVersion,
      identifierType: ITEM_TYPE.CALL_LINK,
      storageNeedsSync: defunctCallLink.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        drop(
          DataWriter.updateDefunctCallLink({
            ...defunctCallLink,
            storageID,
            storageVersion: version,
            storageNeedsSync: false,
          })
        );
      });
    }
  });

  log.info(
    `storageService.upload(${version}): ` +
      `adding pendingCallLinks=${pendingCallLinks.length}`
  );

  pendingCallLinks.forEach(pendingCallLink => {
    const storageRecord = new Proto.StorageRecord();
    storageRecord.callLink = toDefunctOrPendingCallLinkRecord(pendingCallLink);

    const roomId = getRoomIdFromRootKeyString(pendingCallLink.rootKey);
    if (callLinkRoomIds.has(roomId)) {
      return;
    }

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: pendingCallLink.storageID,
      currentStorageVersion: pendingCallLink.storageVersion,
      identifierType: ITEM_TYPE.CALL_LINK,
      storageNeedsSync: pendingCallLink.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        callLinkRefreshJobQueue.updatePendingCallLinkStorageFields(
          pendingCallLink.rootKey,
          {
            ...pendingCallLink,
            storageID,
            storageVersion: version,
            storageNeedsSync: false,
          }
        );
      });
    }
  });

  const unknownRecordsArray: ReadonlyArray<UnknownRecord> = (
    window.storage.get('storage-service-unknown-records') || []
  ).filter((record: UnknownRecord) => !validRecordTypes.has(record.itemType));

  const redactedUnknowns = unknownRecordsArray.map(redactExtendedStorageID);

  log.info(
    `storageService.upload(${version}): adding unknown ` +
      `records=${JSON.stringify(redactedUnknowns)} ` +
      `count=${redactedUnknowns.length}`
  );

  // When updating the manifest, ensure all "unknown" keys are added to the
  // new manifest, so we don't inadvertently delete something we don't understand
  unknownRecordsArray.forEach((record: UnknownRecord) => {
    recordsByID.set(record.storageID, record);
  });

  const recordsWithErrors: ReadonlyArray<UnknownRecord> = window.storage.get(
    'storage-service-error-records',
    new Array<UnknownRecord>()
  );
  const redactedErrors = recordsWithErrors.map(redactExtendedStorageID);

  log.info(
    `storageService.upload(${version}): adding error ` +
      `records=${JSON.stringify(redactedErrors)} count=${redactedErrors.length}`
  );

  // These records failed to merge in the previous fetchManifest, but we still
  // need to include them so that the manifest is complete
  recordsWithErrors.forEach((record: UnknownRecord) => {
    recordsByID.set(record.storageID, record);
  });

  // Delete keys that we wanted to drop during the processing of the manifest.
  const storedPendingDeletes = window.storage.get(
    'storage-service-pending-deletes',
    []
  );
  const redactedPendingDeletes = storedPendingDeletes.map(
    redactExtendedStorageID
  );
  log.info(
    `storageService.upload(${version}): ` +
      `deleting extra keys=${JSON.stringify(redactedPendingDeletes)} ` +
      `count=${redactedPendingDeletes.length}`
  );

  for (const { storageID } of storedPendingDeletes) {
    deleteKeys.add(storageID);
  }

  // Validate before writing

  const duplicates = new Set<string>();
  const typeDuplicates = new Set();
  let hasAccountType = false;
  for (const [storageID, { itemType }] of recordsByID) {
    // Ensure there are no duplicate StorageIdentifiers in your manifest
    //   This can be broken down into two parts:
    //     There are no duplicate type+raw pairs
    //     There are no duplicate raw bytes
    const typeAndID = `${itemType}+${storageID}`;
    if (duplicates.has(storageID) || typeDuplicates.has(typeAndID)) {
      log.warn(
        `storageService.upload(${version}): removing from duplicate item ` +
          'from the manifest',
        redactStorageID(storageID),
        itemType
      );
      recordsByID.delete(storageID);
    }
    duplicates.add(storageID);
    typeDuplicates.add(typeAndID);

    // Ensure all deletes are not present in the manifest
    const hasDeleteKey = deleteKeys.has(storageID);
    if (hasDeleteKey) {
      log.warn(
        `storageService.upload(${version}): removing key which has been deleted`,
        redactStorageID(storageID),
        itemType
      );
      recordsByID.delete(storageID);
    }

    // Ensure that there is *exactly* one Account type in the manifest
    if (itemType === ITEM_TYPE.ACCOUNT) {
      if (hasAccountType) {
        log.warn(
          `storageService.upload(${version}): removing duplicate account`,
          redactStorageID(storageID)
        );
        recordsByID.delete(storageID);
      }
      hasAccountType = true;
    }
  }

  duplicates.clear();
  typeDuplicates.clear();

  const storageKeyDuplicates = new Set<string>();

  for (const storageID of insertKeys) {
    // Ensure there are no duplicate StorageIdentifiers in your list of inserts
    if (storageKeyDuplicates.has(storageID)) {
      log.warn(
        `storageService.upload(${version}): ` +
          'removing duplicate identifier from inserts',
        redactStorageID(storageID)
      );
      insertKeys.delete(storageID);
    }
    storageKeyDuplicates.add(storageID);
  }

  storageKeyDuplicates.clear();

  // If we have a copy of what the current remote manifest is then we run these
  // additional validations comparing our pending manifest to the remote
  // manifest:
  let recordIkm: Uint8Array | undefined;
  if (previousManifest) {
    const pendingInserts: Set<string> = new Set();
    const pendingDeletes: Set<string> = new Set();

    const remoteKeys: Set<string> = new Set();
    (previousManifest.keys ?? []).forEach(
      (identifier: IManifestRecordIdentifier) => {
        strictAssert(identifier.raw, 'Identifier without raw field');
        const storageID = Bytes.toBase64(identifier.raw);
        remoteKeys.add(storageID);
      }
    );

    const localKeys: Set<string> = new Set();
    for (const storageID of recordsByID.keys()) {
      localKeys.add(storageID);

      if (!remoteKeys.has(storageID)) {
        pendingInserts.add(storageID);
      }
    }

    remoteKeys.forEach(storageID => {
      if (!localKeys.has(storageID)) {
        pendingDeletes.add(storageID);
      }
    });

    // Save pending deletes until we have a confirmed upload
    await window.storage.put(
      'storage-service-pending-deletes',
      // Note: `deleteKeys` already includes the prev value of
      // 'storage-service-pending-deletes'
      Array.from(deleteKeys, storageID => ({
        storageID,
        storageVersion: version,
      }))
    );

    if (deleteKeys.size !== pendingDeletes.size) {
      const localDeletes = Array.from(deleteKeys).map(key =>
        redactStorageID(key)
      );
      const remoteDeletes: Array<string> = [];
      pendingDeletes.forEach(id => remoteDeletes.push(redactStorageID(id)));
      log.error(
        `storageService.upload(${version}): delete key sizes do not match`,
        'local',
        localDeletes.join(','),
        'remote',
        remoteDeletes.join(',')
      );
      throw new Error('invalid write delete keys length do not match');
    }
    if (insertKeys.size !== pendingInserts.size) {
      throw new Error('invalid write insert items length do not match');
    }
    for (const storageID of deleteKeys) {
      if (!pendingDeletes.has(storageID)) {
        throw new Error(
          'invalid write delete key missing from pending deletes'
        );
      }
    }
    for (const storageID of insertKeys) {
      if (!pendingInserts.has(storageID)) {
        throw new Error(
          'invalid write insert key missing from pending inserts'
        );
      }
    }

    if (Bytes.isNotEmpty(previousManifest.recordIkm)) {
      recordIkm = previousManifest.recordIkm;
    }
  } else {
    recordIkm = window.storage.get('manifestRecordIkm');
  }

  return {
    postUploadUpdateFunctions,
    recordsByID,
    recordIkm,
    insertKeys,
    deleteKeys,
  };
}

type EncryptManifestOptionsType = {
  recordsByID: Map<string, MergeableItemType | RemoteRecord>;
  recordIkm: Uint8Array | undefined;
  insertKeys: Set<string>;
};

type EncryptedManifestType = {
  newItems: Set<Proto.IStorageItem>;
  storageManifest: Proto.IStorageManifest;
};

async function encryptManifest(
  version: number,
  { recordsByID, recordIkm, insertKeys }: EncryptManifestOptionsType
): Promise<EncryptedManifestType> {
  const manifestRecordKeys: Set<IManifestRecordIdentifier> = new Set();
  const newItems: Set<Proto.IStorageItem> = new Set();

  for (const [storageID, { itemType, storageRecord }] of recordsByID) {
    const identifier = new Proto.ManifestRecord.Identifier({
      type: itemType,
      raw: Bytes.fromBase64(storageID),
    });

    manifestRecordKeys.add(identifier);

    if (insertKeys.has(storageID)) {
      strictAssert(
        storageRecord !== undefined,
        'Inserted items must have an associated record'
      );

      let storageItem;
      try {
        storageItem = encryptRecord(storageID, recordIkm, storageRecord);
      } catch (err) {
        log.error(
          `storageService.upload(${version}): encrypt record failed:`,
          Errors.toLogFormat(err)
        );
        throw err;
      }

      newItems.add(storageItem);
    }
  }

  const manifestRecord = new Proto.ManifestRecord();
  manifestRecord.version = Long.fromNumber(version);
  manifestRecord.sourceDevice = window.storage.user.getDeviceId() ?? 0;
  manifestRecord.keys = Array.from(manifestRecordKeys);
  if (recordIkm != null) {
    manifestRecord.recordIkm = recordIkm;
  }

  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const storageKey = Bytes.fromBase64(storageKeyBase64);
  const storageManifestKey = deriveStorageManifestKey(
    storageKey,
    Long.fromNumber(version)
  );
  const encryptedManifest = encryptProfile(
    Proto.ManifestRecord.encode(manifestRecord).finish(),
    storageManifestKey
  );

  const storageManifest = new Proto.StorageManifest();
  storageManifest.version = manifestRecord.version;
  storageManifest.value = encryptedManifest;

  return {
    newItems,
    storageManifest,
  };
}

async function uploadManifest(
  version: number,
  { postUploadUpdateFunctions, deleteKeys }: GeneratedManifestType,
  { newItems, storageManifest }: EncryptedManifestType
): Promise<void> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.uploadManifest: We are offline!');
  }

  if (newItems.size === 0 && deleteKeys.size === 0) {
    log.info(`storageService.upload(${version}): nothing to upload`);
    return;
  }

  const credentials = window.storage.get('storageCredentials');
  try {
    log.info(
      `storageService.upload(${version}): inserting=${newItems.size} ` +
        `deleting=${deleteKeys.size}`
    );

    const writeOperation = new Proto.WriteOperation();
    writeOperation.manifest = storageManifest;
    writeOperation.insertItem = Array.from(newItems);
    writeOperation.deleteKey = Array.from(deleteKeys).map(storageID =>
      Bytes.fromBase64(storageID)
    );

    await window.textsecure.messaging.modifyStorageRecords(
      Proto.WriteOperation.encode(writeOperation).finish(),
      {
        credentials,
      }
    );

    log.info(
      `storageService.upload(${version}): upload complete, updating ` +
        `items=${postUploadUpdateFunctions.length}`
    );

    // update conversations with the new storageID
    postUploadUpdateFunctions.forEach(fn => fn());
  } catch (err) {
    log.error(
      `storageService.upload(${version}): failed!`,
      Errors.toLogFormat(err)
    );

    if (err.code === 409) {
      if (conflictBackOff.isFull()) {
        log.error(
          `storageService.upload(${version}): exceeded maximum consecutive ` +
            'conflicts'
        );
        return;
      }

      log.info(
        `storageService.upload(${version}): conflict found with ` +
          `version=${version}, running sync job ` +
          `times=${conflictBackOff.getIndex()}`
      );

      throw err;
    }

    throw err;
  }

  log.info(`storageService.upload(${version}): setting new manifestVersion`);
  await window.storage.put('manifestVersion', version);
  conflictBackOff.reset();
  backOff.reset();

  try {
    await singleProtoJobQueue.add(MessageSender.getFetchManifestSyncMessage());
  } catch (error) {
    log.error(
      `storageService.upload(${version}): Failed to queue sync message`,
      Errors.toLogFormat(error)
    );
  }
}

async function stopStorageServiceSync(reason: Error) {
  log.warn('storageService.stopStorageServiceSync', Errors.toLogFormat(reason));

  await window.storage.remove('storageKey');

  if (backOff.isFull()) {
    log.warn(
      'storageService.stopStorageServiceSync: too many consecutive stops'
    );
    return;
  }

  await sleep(backOff.getAndIncrement());
  log.info('storageService.stopStorageServiceSync: requesting new keys');
  setTimeout(async () => {
    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'stopStorageServiceSync: We are primary device; not sending key sync request'
      );
      return;
    }
    try {
      await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
    } catch (error) {
      log.error(
        'storageService.stopStorageServiceSync: Failed to queue sync message',
        Errors.toLogFormat(error)
      );
    }
  });
}

async function createNewManifest() {
  log.info('storageService.createNewManifest: creating new manifest');

  const version = window.storage.get('manifestVersion', 0);

  const generatedManifest = await generateManifest(version, undefined, true);

  const encryptedManifest = await encryptManifest(version, generatedManifest);

  await uploadManifest(
    version,
    {
      ...generatedManifest,
      // we have created a new manifest, there should be no keys to delete
      deleteKeys: new Set(),
    },
    encryptedManifest
  );
}

async function decryptManifest(
  encryptedManifest: Proto.IStorageManifest
): Promise<Proto.ManifestRecord> {
  const { version, value } = encryptedManifest;

  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const storageKey = Bytes.fromBase64(storageKeyBase64);
  const storageManifestKey = deriveStorageManifestKey(
    storageKey,
    dropNull(version)
  );

  strictAssert(value, 'StorageManifest has no value field');
  const decryptedManifest = decryptProfile(value, storageManifestKey);

  return Proto.ManifestRecord.decode(decryptedManifest);
}

async function fetchManifest(
  manifestVersion: number
): Promise<Proto.ManifestRecord | undefined> {
  log.info('storageService.sync: fetch start');

  if (!window.textsecure.messaging) {
    throw new Error('storageService.sync: we are offline!');
  }

  try {
    const credentials =
      await window.textsecure.messaging.getStorageCredentials();
    await window.storage.put('storageCredentials', credentials);

    const manifestBinary = await window.textsecure.messaging.getStorageManifest(
      {
        credentials,
        greaterThanVersion: manifestVersion,
      }
    );
    const encryptedManifest = Proto.StorageManifest.decode(manifestBinary);

    try {
      return await decryptManifest(encryptedManifest);
    } catch (err) {
      await stopStorageServiceSync(err);
    }
  } catch (err) {
    if (err.code === 204) {
      log.info('storageService.sync: no newer manifest, ok');
      return undefined;
    }

    log.error('storageService.sync: failed!', Errors.toLogFormat(err));

    if (err.code === 404) {
      await createNewManifest();
      return undefined;
    }

    throw err;
  }

  return undefined;
}

type MergeableItemType = {
  itemType: number;
  storageID: string;
  storageRecord: Proto.IStorageRecord;
};

type MergedRecordType = UnknownRecord & {
  hasConflict: boolean;
  shouldDrop: boolean;
  hasError: boolean;
  isUnsupported: boolean;
  updatedConversations: ReadonlyArray<ConversationModel>;
  needProfileFetch: ReadonlyArray<ConversationModel>;
};

async function mergeRecord(
  storageVersion: number,
  itemToMerge: MergeableItemType
): Promise<MergedRecordType> {
  const { itemType, storageID, storageRecord } = itemToMerge;
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });

  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;

  let mergeResult: MergeResultType = { hasConflict: false, details: [] };
  let isUnsupported = false;
  let hasError = false;
  let updatedConversations = new Array<ConversationModel>();
  const needProfileFetch = new Array<ConversationModel>();

  try {
    if (itemType === ITEM_TYPE.UNKNOWN) {
      log.warn(
        'storageService.mergeRecord: Unknown item type',
        redactedStorageID
      );
    } else if (itemType === ITEM_TYPE.CONTACT && storageRecord.contact) {
      mergeResult = await mergeContactRecord(
        storageID,
        storageVersion,
        storageRecord.contact
      );
    } else if (itemType === ITEM_TYPE.GROUPV1 && storageRecord.groupV1) {
      mergeResult = await mergeGroupV1Record(
        storageID,
        storageVersion,
        storageRecord.groupV1
      );
    } else if (itemType === ITEM_TYPE.GROUPV2 && storageRecord.groupV2) {
      mergeResult = await mergeGroupV2Record(
        storageID,
        storageVersion,
        storageRecord.groupV2
      );
    } else if (itemType === ITEM_TYPE.ACCOUNT && storageRecord.account) {
      mergeResult = await mergeAccountRecord(
        storageID,
        storageVersion,
        storageRecord.account
      );
    } else if (
      itemType === ITEM_TYPE.STORY_DISTRIBUTION_LIST &&
      storageRecord.storyDistributionList
    ) {
      mergeResult = await mergeStoryDistributionListRecord(
        storageID,
        storageVersion,
        storageRecord.storyDistributionList
      );
    } else if (
      itemType === ITEM_TYPE.STICKER_PACK &&
      storageRecord.stickerPack
    ) {
      mergeResult = await mergeStickerPackRecord(
        storageID,
        storageVersion,
        storageRecord.stickerPack
      );
    } else if (itemType === ITEM_TYPE.CALL_LINK && storageRecord.callLink) {
      mergeResult = await mergeCallLinkRecord(
        storageID,
        storageVersion,
        storageRecord.callLink
      );
    } else {
      isUnsupported = true;
      log.warn(
        `storageService.merge(${redactedStorageID}): unknown item type=${itemType}`
      );
    }

    const redactedID = redactStorageID(
      storageID,
      storageVersion,
      mergeResult.conversation
    );
    const oldID = mergeResult.oldStorageID
      ? redactStorageID(mergeResult.oldStorageID, mergeResult.oldStorageVersion)
      : '?';
    updatedConversations = [
      ...updatedConversations,
      ...(mergeResult.updatedConversations ?? []),
    ];
    if (mergeResult.needsProfileFetch) {
      strictAssert(mergeResult.conversation, 'needsProfileFetch, but no convo');
      needProfileFetch.push(mergeResult.conversation);
    }

    log.info(
      `storageService.merge(${redactedID}): merged item type=${itemType} ` +
        `oldID=${oldID} ` +
        `conflict=${mergeResult.hasConflict} ` +
        `shouldDrop=${Boolean(mergeResult.shouldDrop)} ` +
        `details=${JSON.stringify(mergeResult.details)}`
    );
  } catch (err) {
    hasError = true;
    const redactedID = redactStorageID(storageID, storageVersion);
    log.error(
      `storageService.merge(${redactedID}): error with ` +
        `item type=${itemType} ` +
        `details=${Errors.toLogFormat(err)}`
    );
  }

  return {
    hasConflict: mergeResult.hasConflict,
    shouldDrop: Boolean(mergeResult.shouldDrop),
    hasError,
    isUnsupported,
    itemType,
    storageID,
    updatedConversations,
    needProfileFetch,
  };
}

type NonConversationRecordsResultType = Readonly<{
  callLinkDbRecords: ReadonlyArray<CallLinkRecord>;
  defunctCallLinks: ReadonlyArray<DefunctCallLinkType>;
  pendingCallLinks: ReadonlyArray<PendingCallLinkType>;
  installedStickerPacks: ReadonlyArray<StickerPackType>;
  uninstalledStickerPacks: ReadonlyArray<UninstalledStickerPackType>;
  storyDistributionLists: ReadonlyArray<StoryDistributionWithMembersType>;
}>;

// TODO: DESKTOP-3929
async function getNonConversationRecords(): Promise<NonConversationRecordsResultType> {
  const [
    callLinkDbRecords,
    defunctCallLinks,
    pendingCallLinks,
    storyDistributionLists,
    uninstalledStickerPacks,
    installedStickerPacks,
  ] = await Promise.all([
    DataReader.getAllCallLinkRecordsWithAdminKey(),
    DataReader.getAllDefunctCallLinksWithAdminKey(),
    callLinkRefreshJobQueue.getPendingAdminCallLinks(),
    DataReader.getAllStoryDistributionsWithMembers(),
    DataReader.getUninstalledStickerPacks(),
    DataReader.getInstalledStickerPacks(),
  ]);

  return {
    callLinkDbRecords,
    defunctCallLinks,
    pendingCallLinks,
    storyDistributionLists,
    uninstalledStickerPacks,
    installedStickerPacks,
  };
}

async function processManifest(
  manifest: Proto.IManifestRecord,
  version: number
): Promise<number> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.processManifest: We are offline!');
  }

  const remoteKeysTypeMap = new Map();
  (manifest.keys || []).forEach(({ raw, type }: IManifestRecordIdentifier) => {
    strictAssert(raw, 'Identifier without raw field');
    remoteKeysTypeMap.set(Bytes.toBase64(raw), type);
  });

  const remoteKeys = new Set(remoteKeysTypeMap.keys());
  const localVersions = new Map<string, number | undefined>();
  let localRecordCount = 0;

  const conversations = window.getConversations();
  conversations.forEach((conversation: ConversationModel) => {
    const storageID = conversation.get('storageID');
    if (storageID) {
      localVersions.set(storageID, conversation.get('storageVersion'));
    }
  });
  localRecordCount += conversations.length;

  {
    const {
      callLinkDbRecords,
      defunctCallLinks,
      pendingCallLinks,
      storyDistributionLists,
      installedStickerPacks,
      uninstalledStickerPacks,
    } = await getNonConversationRecords();

    const collectLocalKeysFromFields = ({
      storageID,
      storageVersion,
    }: StorageServiceFieldsType): void => {
      if (storageID) {
        localVersions.set(storageID, storageVersion);
      }
    };

    callLinkDbRecords.forEach(dbRecord =>
      collectLocalKeysFromFields(callLinkFromRecord(dbRecord))
    );
    localRecordCount += callLinkDbRecords.length;

    defunctCallLinks.forEach(collectLocalKeysFromFields);
    localRecordCount += defunctCallLinks.length;

    pendingCallLinks.forEach(collectLocalKeysFromFields);
    localRecordCount += pendingCallLinks.length;

    storyDistributionLists.forEach(collectLocalKeysFromFields);
    localRecordCount += storyDistributionLists.length;

    uninstalledStickerPacks.forEach(collectLocalKeysFromFields);
    localRecordCount += uninstalledStickerPacks.length;

    installedStickerPacks.forEach(collectLocalKeysFromFields);
    localRecordCount += installedStickerPacks.length;
  }

  const unknownRecordsArray: ReadonlyArray<UnknownRecord> =
    window.storage.get('storage-service-unknown-records') || [];

  const stillUnknown = unknownRecordsArray.filter((record: UnknownRecord) => {
    // Do not include any unknown records that we already support
    if (!validRecordTypes.has(record.itemType)) {
      localVersions.set(record.storageID, record.storageVersion);
      return false;
    }
    return true;
  });

  const remoteOnlySet = new Set<string>();
  for (const key of remoteKeys) {
    if (!localVersions.has(key)) {
      remoteOnlySet.add(key);
    }
  }

  const localOnlySet = new Set<string>();
  for (const key of localVersions.keys()) {
    if (!remoteKeys.has(key)) {
      localOnlySet.add(key);
    }
  }

  const redactedRemoteOnly = Array.from(remoteOnlySet).map(id =>
    redactStorageID(id, version)
  );
  const redactedLocalOnly = Array.from(localOnlySet).map(id =>
    redactStorageID(id, localVersions.get(id))
  );

  log.info(
    `storageService.process(${version}): localRecords=${localRecordCount} ` +
      `localKeys=${localVersions.size} unknownKeys=${stillUnknown.length} ` +
      `remoteKeys=${remoteKeys.size}`
  );
  log.info(
    `storageService.process(${version}): ` +
      `remoteOnlyCount=${remoteOnlySet.size} ` +
      `remoteOnlyKeys=${JSON.stringify(redactedRemoteOnly)}`
  );
  log.info(
    `storageService.process(${version}): ` +
      `localOnlyCount=${localOnlySet.size} ` +
      `localOnlyKeys=${JSON.stringify(redactedLocalOnly)}`
  );

  const remoteOnlyRecords = new Map<string, RemoteRecord>();
  remoteOnlySet.forEach(storageID => {
    remoteOnlyRecords.set(storageID, {
      storageID,
      itemType: remoteKeysTypeMap.get(storageID),
    });
  });

  let conflictCount = 0;
  if (remoteOnlyRecords.size) {
    const fetchResult = await fetchRemoteRecords(
      version,
      Bytes.isNotEmpty(manifest.recordIkm) ? manifest.recordIkm : undefined,
      remoteOnlyRecords
    );
    conflictCount = await processRemoteRecords(version, fetchResult);
  }

  // Post-merge, if our local records contain any storage IDs that were not
  // present in the remote manifest then we'll need to clear it, generate a
  // new storageID for that record, and upload.
  // This might happen if a device pushes a manifest which doesn't contain
  // the keys that we have in our local database.
  window.getConversations().forEach((conversation: ConversationModel) => {
    const storageID = conversation.get('storageID');
    if (storageID && !remoteKeys.has(storageID)) {
      const storageVersion = conversation.get('storageVersion');
      const missingKey = redactStorageID(
        storageID,
        storageVersion,
        conversation
      );

      // Remote might have dropped this conversation already, but our value of
      // `firstUnregisteredAt` is too high for us to drop it. Don't reupload it!
      if (
        isDirectConversation(conversation.attributes) &&
        conversation.isUnregistered()
      ) {
        log.info(
          `storageService.process(${version}): localKey=${missingKey} is ` +
            'unregistered and not in remote manifest'
        );
        conversation.setUnregistered({
          timestamp: Date.now() - getMessageQueueTime(),
          fromStorageService: true,

          // Saving below
          shouldSave: false,
        });
      } else {
        log.info(
          `storageService.process(${version}): localKey=${missingKey} ` +
            'was not in remote manifest'
        );
      }
      conversation.unset('storageID');
      conversation.unset('storageVersion');
      drop(updateConversation(conversation.attributes));
    }
  });

  // Refetch various records post-merge
  {
    const {
      callLinkDbRecords,
      defunctCallLinks,
      pendingCallLinks,
      storyDistributionLists,
      installedStickerPacks,
      uninstalledStickerPacks,
    } = await getNonConversationRecords();

    uninstalledStickerPacks.forEach(stickerPack => {
      const { storageID, storageVersion } = stickerPack;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      void DataWriter.addUninstalledStickerPack({
        ...stickerPack,
        storageID: undefined,
        storageVersion: undefined,
      });
    });

    installedStickerPacks.forEach(stickerPack => {
      const { storageID, storageVersion } = stickerPack;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      void DataWriter.updateStickerPackInfo({
        id: stickerPack.id,
        key: stickerPack.key,

        storageID: undefined,
        storageVersion: undefined,
        storageUnknownFields: undefined,
        storageNeedsSync: false,
        uninstalledAt: stickerPack.uninstalledAt,
      });
    });

    storyDistributionLists.forEach(storyDistributionList => {
      const { storageID, storageVersion } = storyDistributionList;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      void DataWriter.modifyStoryDistribution({
        ...storyDistributionList,
        storageID: undefined,
        storageVersion: undefined,
      });
    });

    // Check to make sure we have a "My Stories" distribution list set up
    const myStories = storyDistributionLists.find(
      ({ id }) => id === MY_STORY_ID
    );

    if (!myStories) {
      log.info(`storageService.process(${version}): creating my stories`);
      const storyDistribution: StoryDistributionWithMembersType = {
        allowsReplies: true,
        id: MY_STORY_ID,
        isBlockList: true,
        members: [],
        name: MY_STORY_ID,
        senderKeyInfo: undefined,
        storageNeedsSync: true,
      };

      await DataWriter.createNewStoryDistribution(storyDistribution);

      const shouldSave = false;
      window.reduxActions.storyDistributionLists.createDistributionList(
        storyDistribution.name,
        storyDistribution.members,
        storyDistribution,
        shouldSave
      );

      conflictCount += 1;
    }

    callLinkDbRecords.forEach(callLinkDbRecord => {
      const { storageID, storageVersion } = callLinkDbRecord;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(
        storageID,
        storageVersion || undefined
      );
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      const callLink = callLinkFromRecord(callLinkDbRecord);
      drop(
        DataWriter.updateCallLink({
          ...callLink,
          storageID: undefined,
          storageVersion: undefined,
        })
      );
    });

    defunctCallLinks.forEach(defunctCallLink => {
      const { storageID, storageVersion } = defunctCallLink;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      drop(
        DataWriter.updateDefunctCallLink({
          ...defunctCallLink,
          storageID: undefined,
          storageVersion: undefined,
        })
      );
    });

    pendingCallLinks.forEach(pendingCallLink => {
      const { storageID, storageVersion } = pendingCallLink;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      callLinkRefreshJobQueue.updatePendingCallLinkStorageFields(
        pendingCallLink.rootKey,
        {
          ...pendingCallLink,
          storageID: undefined,
          storageVersion: undefined,
        }
      );
    });
  }

  log.info(
    `storageService.process(${version}): conflictCount=${conflictCount}`
  );

  return conflictCount;
}

export type FetchRemoteRecordsResultType = Readonly<{
  missingKeys: Set<string>;
  decryptedItems: ReadonlyArray<MergeableItemType>;
}>;

async function fetchRemoteRecords(
  storageVersion: number,
  recordIkm: Uint8Array | undefined,
  remoteOnlyRecords: Map<string, RemoteRecord>
): Promise<FetchRemoteRecordsResultType> {
  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('messaging is not available');
  }

  const storageKey = Bytes.fromBase64(storageKeyBase64);

  log.info(
    `storageService.fetchRemoteRecords(${storageVersion}): ` +
      `fetching remote keys count=${remoteOnlyRecords.size}`
  );

  const credentials = window.storage.get('storageCredentials');
  const batches = chunk(Array.from(remoteOnlyRecords.keys()), MAX_READ_KEYS);

  const storageItems = (
    await pMap(
      batches,
      async (
        batch: ReadonlyArray<string>
      ): Promise<Array<Proto.IStorageItem>> => {
        const readOperation = new Proto.ReadOperation();
        readOperation.readKey = batch.map(Bytes.fromBase64);

        const storageItemsBuffer = await messaging.getStorageRecords(
          Proto.ReadOperation.encode(readOperation).finish(),
          {
            credentials,
          }
        );

        return Proto.StorageItems.decode(storageItemsBuffer).items ?? [];
      },
      { concurrency: 5 }
    )
  ).flat();

  const missingKeys = new Set<string>(remoteOnlyRecords.keys());

  const decryptedItems = await pMap(
    storageItems,
    async (
      storageRecordWrapper: Proto.IStorageItem
    ): Promise<MergeableItemType> => {
      const { key, value: storageItemCiphertext } = storageRecordWrapper;

      if (!key || !storageItemCiphertext) {
        const error = new Error(
          `storageService.process(${storageVersion}): ` +
            'missing key and/or Ciphertext'
        );
        await stopStorageServiceSync(error);
        throw error;
      }

      const base64ItemID = Bytes.toBase64(key);
      missingKeys.delete(base64ItemID);

      const storageItemKey = deriveStorageItemKey({
        storageServiceKey: storageKey,
        recordIkm,
        key,
      });

      let storageItemPlaintext;
      try {
        storageItemPlaintext = decryptProfile(
          storageItemCiphertext,
          storageItemKey
        );
      } catch (err) {
        log.error(
          `storageService.process(${storageVersion}): ` +
            'Error decrypting storage item',
          Errors.toLogFormat(err)
        );
        await stopStorageServiceSync(err);
        throw err;
      }

      const storageRecord = Proto.StorageRecord.decode(storageItemPlaintext);

      const remoteRecord = remoteOnlyRecords.get(base64ItemID);
      if (!remoteRecord) {
        const redactedStorageID = redactExtendedStorageID({
          storageID: base64ItemID,
          storageVersion,
        });
        throw new Error(
          "Got a remote record that wasn't requested with " +
            `storageID: ${redactedStorageID}`
        );
      }

      return {
        itemType: remoteRecord.itemType,
        storageID: base64ItemID,
        storageRecord,
      };
    },
    { concurrency: 5 }
  );

  const redactedMissingKeys = Array.from(missingKeys).map(id =>
    redactStorageID(id, storageVersion)
  );

  log.info(
    `storageService.fetchRemoteRecords(${storageVersion}): missing remote ` +
      `keys=${JSON.stringify(redactedMissingKeys)} ` +
      `count=${missingKeys.size}`
  );

  return { decryptedItems, missingKeys };
}

async function processRemoteRecords(
  storageVersion: number,
  { decryptedItems, missingKeys }: FetchRemoteRecordsResultType
): Promise<number> {
  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;
  const droppedKeys = new Set<string>();

  // Drop all GV1 records for which we have GV2 record in the same manifest
  const masterKeys = new Map<string, string>();
  for (const { itemType, storageID, storageRecord } of decryptedItems) {
    if (itemType === ITEM_TYPE.GROUPV2 && storageRecord.groupV2?.masterKey) {
      masterKeys.set(
        Bytes.toBase64(storageRecord.groupV2.masterKey),
        storageID
      );
    }
  }

  let accountItem: MergeableItemType | undefined;

  let prunedStorageItems = decryptedItems.filter(item => {
    const { itemType, storageID, storageRecord } = item;
    if (itemType === ITEM_TYPE.ACCOUNT) {
      if (accountItem !== undefined) {
        log.warn(
          `storageService.process(${storageVersion}): duplicate account ` +
            `record=${redactStorageID(storageID, storageVersion)} ` +
            `previous=${redactStorageID(accountItem.storageID, storageVersion)}`
        );
        droppedKeys.add(accountItem.storageID);
      }

      accountItem = item;
      return false;
    }

    if (itemType !== ITEM_TYPE.GROUPV1 || !storageRecord.groupV1?.id) {
      return true;
    }

    const masterKey = deriveMasterKeyFromGroupV1(storageRecord.groupV1.id);
    const gv2StorageID = masterKeys.get(Bytes.toBase64(masterKey));
    if (!gv2StorageID) {
      return true;
    }

    log.warn(
      `storageService.process(${storageVersion}): dropping ` +
        `GV1 record=${redactStorageID(storageID, storageVersion)} ` +
        `GV2 record=${redactStorageID(gv2StorageID, storageVersion)} ` +
        'is in the same manifest'
    );
    droppedKeys.add(storageID);

    return false;
  });

  // Find remote contact records that:
  // - Have `remote.pni` and have `remote.serviceE164`
  // - Match local contact that has `aci`.
  const splitPNIContacts = new Array<MergeableItemType>();
  prunedStorageItems = prunedStorageItems.filter(item => {
    const { itemType, storageRecord } = item;
    const { contact } = storageRecord;
    if (itemType !== ITEM_TYPE.CONTACT || !contact) {
      return true;
    }

    if (!contact.serviceE164 || !contact.pni) {
      return true;
    }

    const localAci = window.ConversationController.get(contact.pni)?.getAci();
    if (!localAci) {
      return true;
    }

    splitPNIContacts.push(item);
    return false;
  });

  try {
    log.info(
      `storageService.process(${storageVersion}): ` +
        `attempting to merge records=${prunedStorageItems.length}`
    );
    if (accountItem !== undefined) {
      log.info(
        `storageService.process(${storageVersion}): account ` +
          `record=${redactStorageID(accountItem.storageID, storageVersion)}`
      );
    }
    if (splitPNIContacts.length !== 0) {
      log.info(
        `storageService.process(${storageVersion}): ` +
          `split pni contacts=${splitPNIContacts.length}`
      );
    }

    const mergeWithConcurrency = (
      items: ReadonlyArray<MergeableItemType>
    ): Promise<Array<MergedRecordType>> => {
      return pMap(
        items,
        (item: MergeableItemType) => mergeRecord(storageVersion, item),
        { concurrency: 32 }
      );
    };

    const mergedRecords = [
      ...(await mergeWithConcurrency(prunedStorageItems)),

      // Merge split PNI contacts after processing remote records. If original
      // e164+ACI+PNI contact is unregistered - it is going to be split so we
      // have to make that happen first. Otherwise we will ignore ContactRecord
      // changes on these since there is already a parent "merged" contact.
      ...(await mergeWithConcurrency(splitPNIContacts)),

      // Merge Account records last since it contains the pinned conversations
      // and we need all other records merged first before we can find the pinned
      // records in our db
      ...(accountItem ? [await mergeRecord(storageVersion, accountItem)] : []),
    ];

    log.info(
      `storageService.process(${storageVersion}): ` +
        `processed records=${mergedRecords.length}`
    );

    const updatedConversations = mergedRecords
      .map(record => record.updatedConversations)
      .flat()
      .map(convo => convo.attributes);
    await updateConversations(updatedConversations);

    log.info(
      `storageService.process(${storageVersion}): ` +
        `updated conversations=${updatedConversations.length}`
    );

    const needProfileFetch = mergedRecords
      .map(record => record.needProfileFetch)
      .flat();

    log.info(
      `storageService.process(${storageVersion}): ` +
        `kicking off profile fetches=${needProfileFetch.length}`
    );

    // Intentionally not awaiting
    needProfileFetch.map(convo =>
      drop(
        convo.getProfiles().catch(() => {
          /* nothing to do here; logging already happened */
        })
      )
    );

    // Collect full map of previously and currently unknown records
    const unknownRecords: Map<string, UnknownRecord> = new Map();

    const previousUnknownRecords: ReadonlyArray<UnknownRecord> =
      window.storage.get(
        'storage-service-unknown-records',
        new Array<UnknownRecord>()
      );
    previousUnknownRecords.forEach((record: UnknownRecord) => {
      unknownRecords.set(record.storageID, record);
    });

    const newRecordsWithErrors: Array<UnknownRecord> = [];

    let conflictCount = 0;

    mergedRecords.forEach((mergedRecord: MergedRecordType) => {
      if (mergedRecord.isUnsupported) {
        unknownRecords.set(mergedRecord.storageID, {
          itemType: mergedRecord.itemType,
          storageID: mergedRecord.storageID,
          storageVersion,
        });
      } else if (mergedRecord.hasError) {
        newRecordsWithErrors.push({
          itemType: mergedRecord.itemType,
          storageID: mergedRecord.storageID,
          storageVersion,
        });
      }

      if (mergedRecord.hasConflict) {
        conflictCount += 1;
      }

      if (mergedRecord.shouldDrop) {
        droppedKeys.add(mergedRecord.storageID);
      }
    });

    const redactedDroppedKeys = Array.from(droppedKeys.values()).map(key =>
      redactStorageID(key, storageVersion)
    );
    log.info(
      `storageService.process(${storageVersion}): ` +
        `dropped keys=${JSON.stringify(redactedDroppedKeys)} ` +
        `count=${redactedDroppedKeys.length}`
    );

    // Filter out all the unknown records we're already supporting
    const newUnknownRecords = Array.from(unknownRecords.values()).filter(
      (record: UnknownRecord) => !validRecordTypes.has(record.itemType)
    );
    const redactedNewUnknowns = newUnknownRecords.map(redactExtendedStorageID);

    log.info(
      `storageService.process(${storageVersion}): ` +
        `unknown records=${JSON.stringify(redactedNewUnknowns)} ` +
        `count=${redactedNewUnknowns.length}`
    );
    await window.storage.put(
      'storage-service-unknown-records',
      newUnknownRecords
    );

    const redactedErrorRecords = newRecordsWithErrors.map(
      redactExtendedStorageID
    );
    log.info(
      `storageService.process(${storageVersion}): ` +
        `error records=${JSON.stringify(redactedErrorRecords)} ` +
        `count=${redactedErrorRecords.length}`
    );
    // Refresh the list of records that had errors with every push, that way
    // this list doesn't grow unbounded and we keep the list of storage keys
    // fresh.
    await window.storage.put(
      'storage-service-error-records',
      newRecordsWithErrors
    );

    // Store/overwrite keys pending deletion, but use them only when we have to
    // upload a new manifest to avoid oscillation.
    const pendingDeletes = [...missingKeys, ...droppedKeys].map(storageID => ({
      storageID,
      storageVersion,
    }));
    const redactedPendingDeletes = pendingDeletes.map(redactExtendedStorageID);
    log.info(
      `storageService.process(${storageVersion}): ` +
        `pending deletes=${JSON.stringify(redactedPendingDeletes)} ` +
        `count=${redactedPendingDeletes.length}`
    );
    await window.storage.put('storage-service-pending-deletes', pendingDeletes);

    if (conflictCount === 0) {
      conflictBackOff.reset();
    }

    return conflictCount;
  } catch (err) {
    log.error(
      `storageService.process(${storageVersion}): ` +
        'failed to process remote records',
      Errors.toLogFormat(err)
    );
  }

  // conflictCount
  return 0;
}

async function sync({
  ignoreConflicts = false,
  reason,
}: {
  ignoreConflicts?: boolean;
  reason: string;
}): Promise<Proto.ManifestRecord | undefined> {
  if (!window.storage.get('storageKey')) {
    const masterKeyBase64 = window.storage.get('masterKey');
    if (!masterKeyBase64) {
      log.error(
        `storageService.sync(${reason}): Cannot start; no storage or master key!`
      );
      return;
    }

    const masterKey = Bytes.fromBase64(masterKeyBase64);
    const storageKeyBase64 = Bytes.toBase64(deriveStorageServiceKey(masterKey));
    await window.storage.put('storageKey', storageKeyBase64);

    log.warn('storageService.sync: fixed storage key');
  }

  log.info(
    `storageService.sync: starting... ignoreConflicts=${ignoreConflicts}, reason=${reason}`
  );

  let manifest: Proto.ManifestRecord | undefined;
  try {
    // If we've previously interacted with storage service, update 'fetchComplete' record
    const previousFetchComplete = window.storage.get('storageFetchComplete');
    const manifestFromStorage = window.storage.get('manifestVersion');
    if (!previousFetchComplete && isNumber(manifestFromStorage)) {
      await window.storage.put('storageFetchComplete', true);
    }

    const localManifestVersion = manifestFromStorage || 0;

    log.info(
      'storageService.sync: fetching latest ' +
        `after version=${localManifestVersion}`
    );
    manifest = await fetchManifest(localManifestVersion);

    // Guarding against no manifests being returned, everything should be ok
    if (!manifest) {
      log.info(
        `storageService.sync: no updates, version=${localManifestVersion}`
      );
      return undefined;
    }

    strictAssert(manifest.version != null, 'Manifest without version');
    const version = manifest.version?.toNumber() ?? 0;

    log.info(
      `storageService.sync: updating to remoteVersion=${version} ` +
        `sourceDevice=${manifest.sourceDevice ?? '?'} from ` +
        `version=${localManifestVersion}`
    );

    const conflictCount = await processManifest(manifest, version);

    log.info(
      `storageService.sync: updated to version=${version} ` +
        `conflicts=${conflictCount}`
    );

    await window.storage.put('manifestVersion', version);
    if (Bytes.isNotEmpty(manifest.recordIkm)) {
      await window.storage.put('manifestRecordIkm', manifest.recordIkm);
    } else {
      await window.storage.remove('manifestRecordIkm');
    }

    const hasConflicts = conflictCount !== 0;
    if (hasConflicts && !ignoreConflicts) {
      await upload({ fromSync: true, reason: `sync/${reason}` });
    }

    // We now know that we've successfully completed a storage service fetch
    await window.storage.put('storageFetchComplete', true);

    if (window.SignalCI) {
      window.SignalCI.handleEvent('storageServiceComplete', {
        manifestVersion: version,
      });
    }
  } catch (err) {
    log.error(
      'storageService.sync: error processing manifest',
      Errors.toLogFormat(err)
    );
  }

  log.info('storageService.sync: complete');
  return manifest;
}

async function upload({
  fromSync = false,
  reason,
}: {
  fromSync?: boolean;
  reason: string;
}): Promise<void> {
  const logId = `storageService.upload/${reason}`;

  if (!window.textsecure.messaging) {
    throw new Error(`${logId}: We are offline!`);
  }

  // Rate limit uploads coming from syncing
  if (fromSync) {
    uploadBucket.push(Date.now());
    if (uploadBucket.length >= 3) {
      const [firstMostRecentWrite] = uploadBucket;

      if (isMoreRecentThan(5 * durations.MINUTE, firstMostRecentWrite)) {
        throw new Error(`${logId}: too many writes too soon.`);
      }

      uploadBucket.shift();
    }
  }

  if (!window.storage.get('storageKey')) {
    // requesting new keys runs the sync job which will detect the conflict
    // and re-run the upload job once we're merged and up-to-date.
    log.info(`${logId}: no storageKey, requesting new keys`);
    backOff.reset();

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(`${logId}: We are primary device; not sending key sync request`);
      return;
    }

    try {
      await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
    } catch (error) {
      log.error(
        `${logId}: Failed to queue sync message`,
        Errors.toLogFormat(error)
      );
    }

    return;
  }

  let previousManifest: Proto.ManifestRecord | undefined;
  if (!fromSync) {
    // Syncing before we upload so that we repair any unknown records and
    // records with errors as well as ensure that we have the latest up to date
    // manifest.
    // We are going to upload after this sync so we can ignore any conflicts
    // that arise during the sync.
    const ignoreConflicts = true;
    previousManifest = await sync({
      ignoreConflicts,
      reason: `upload/${reason}`,
    });
  }

  const localManifestVersion = window.storage.get('manifestVersion', 0);
  const version = Number(localManifestVersion) + 1;

  log.info(`${logId}/${version}: will update to manifest version`);

  try {
    const generatedManifest = await generateManifest(
      version,
      previousManifest,
      false
    );
    const encryptedManifest = await encryptManifest(version, generatedManifest);
    await uploadManifest(version, generatedManifest, encryptedManifest);

    // Clear pending delete keys after successful upload
    await window.storage.put('storage-service-pending-deletes', []);
  } catch (err) {
    if (err.code === 409) {
      await sleep(conflictBackOff.getAndIncrement());
      log.info(`${logId}: pushing sync on the queue`);
      // The sync job will check for conflicts and as part of that conflict
      // check if an item needs sync and doesn't match with the remote record
      // it'll kick off another upload.
      setTimeout(() =>
        runStorageServiceSyncJob({ reason: `409 conflict backoff/${reason}` })
      );
      return;
    }
    log.error(`${logId}/${version}: error`, Errors.toLogFormat(err));
  }
}

let storageServiceEnabled = false;

export function enableStorageService(): void {
  storageServiceEnabled = true;
}

export function disableStorageService(): void {
  storageServiceEnabled = false;
}

export async function eraseAllStorageServiceState({
  keepUnknownFields = false,
}: { keepUnknownFields?: boolean } = {}): Promise<void> {
  log.info('storageService.eraseAllStorageServiceState: starting...');

  // First, update high-level storage service metadata
  await Promise.all([
    window.storage.remove('manifestVersion'),
    window.storage.remove('manifestRecordIkm'),
    keepUnknownFields
      ? Promise.resolve()
      : window.storage.remove('storage-service-unknown-records'),
    window.storage.remove('storageCredentials'),
  ]);

  // Then, we make the changes to records in memory:
  //   - Conversations
  //   - Sticker packs
  //   - Uninstalled sticker packs
  //   - Story distribution lists

  // This call just erases stickers for now. Storage service data is not stored
  //   in memory for Story Distribution Lists. Uninstalled sticker packs are not
  //   kept in memory at all.
  window.reduxActions.user.eraseStorageServiceState();

  // Conversations. These properties are not present in redux.
  window.getConversations().forEach(conversation => {
    conversation.unset('storageID');
    conversation.unset('needsStorageServiceSync');
    conversation.unset('storageUnknownFields');
  });

  // Then make sure outstanding conversation saves are flushed
  await flushUpdateConversationBatcher();

  // Then make sure that all previously-outstanding database saves are flushed
  await getItemById('manifestVersion');

  // Finally, we update the database directly for all record types:
  await eraseStorageServiceState();

  log.info('storageService.eraseAllStorageServiceState: complete');
}

export async function reprocessUnknownFields(): Promise<void> {
  ourProfileKeyService.blockGetWithPromise(
    storageJobQueue(async () => {
      const version = window.storage.get('manifestVersion') ?? 0;

      log.info(`storageService.reprocessUnknownFields(${version}): starting`);

      const { recordsByID, insertKeys } = await generateManifest(
        version,
        undefined,
        true
      );

      const newRecords = Array.from(
        filter(
          map(recordsByID, ([key, item]): MergeableItemType | undefined => {
            if (!insertKeys.has(key)) {
              return undefined;
            }
            strictAssert(
              item.storageRecord !== undefined,
              'Inserted records must have storageRecord'
            );

            if (!item.storageRecord.$unknownFields?.length) {
              return undefined;
            }

            return {
              ...item,

              storageRecord: Proto.StorageRecord.decode(
                Proto.StorageRecord.encode(item.storageRecord).finish()
              ),
            };
          }),
          isNotNil
        )
      );

      const conflictCount = await processRemoteRecords(version, {
        decryptedItems: newRecords,
        missingKeys: new Set(),
      });

      log.info(
        `storageService.reprocessUnknownFields(${version}): done, ` +
          `conflictCount=${conflictCount}`
      );

      const hasConflicts = conflictCount !== 0;
      if (hasConflicts) {
        log.info(
          `storageService.reprocessUnknownFields(${version}): uploading`
        );
        await upload({ reason: 'reprocessUnknownFields/hasConflicts' });
      }
    })
  );
}

export const storageServiceUploadJob = debounce(
  ({ reason }: { reason: string }) => {
    if (!storageServiceEnabled) {
      log.info('storageService.storageServiceUploadJob: called before enabled');
      return;
    }

    void storageJobQueue(
      async () => {
        await upload({ reason: `storageServiceUploadJob/${reason}` });
      },
      `upload v${window.storage.get('manifestVersion')}`
    );
  },
  500
);

export const runStorageServiceSyncJob = debounce(
  ({ reason }: { reason: string }) => {
    if (!storageServiceEnabled) {
      log.info(
        'storageService.runStorageServiceSyncJob: called before enabled'
      );
      return;
    }

    ourProfileKeyService.blockGetWithPromise(
      storageJobQueue(
        async () => {
          await sync({ reason });

          // Notify listeners about sync completion
          window.Whisper.events.trigger('storageService:syncComplete');
        },
        `sync v${window.storage.get('manifestVersion')}`
      )
    );
  },
  500
);

export const addPendingDelete = (item: ExtendedStorageID): void => {
  void storageJobQueue(
    async () => {
      const storedPendingDeletes = window.storage.get(
        'storage-service-pending-deletes',
        []
      );
      await window.storage.put('storage-service-pending-deletes', [
        ...storedPendingDeletes,
        item,
      ]);
    },
    `addPendingDelete(${redactExtendedStorageID(item)})`
  );
};
