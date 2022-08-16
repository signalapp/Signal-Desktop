// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, isNumber, chunk } from 'lodash';
import pMap from 'p-map';
import Long from 'long';

import dataInterface from '../sql/Client';
import * as Bytes from '../Bytes';
import {
  getRandomBytes,
  deriveStorageItemKey,
  deriveStorageManifestKey,
  encryptProfile,
  decryptProfile,
  deriveMasterKeyFromGroupV1,
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
} from './storageRecordOps';
import type { MergeResultType } from './storageRecordOps';
import { MAX_READ_KEYS } from './storageConstants';
import type { ConversationModel } from '../models/conversations';
import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import * as durations from '../util/durations';
import { BackOff } from '../util/BackOff';
import { storageJobQueue } from '../util/JobQueue';
import { sleep } from '../util/sleep';
import { isMoreRecentThan } from '../util/timestamp';
import { ourProfileKeyService } from './ourProfileKey';
import {
  ConversationTypes,
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
import { MY_STORIES_ID } from '../types/Stories';

type IManifestRecordIdentifier = Proto.ManifestRecord.IIdentifier;

const {
  eraseStorageServiceStateFromConversations,
  updateConversation,
  updateConversations,
} = dataInterface;

const uploadBucket: Array<number> = [];

const validRecordTypes = new Set([
  0, // UNKNOWN
  1, // CONTACT
  2, // GROUPV1
  3, // GROUPV2
  4, // ACCOUNT
  5, // STORY_DISTRIBUTION_LIST
  6, // STICKER_PACK
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

function redactStorageID(
  storageID: string,
  version?: number,
  conversation?: ConversationModel
): string {
  const convoId = conversation ? ` ${conversation?.idForLogging()}` : '';
  return `${version ?? '?'}:${storageID.substring(0, 3)}${convoId}`;
}

function redactExtendedStorageID({
  storageID,
  storageVersion,
}: ExtendedStorageID): string {
  return redactStorageID(storageID, storageVersion);
}

function encryptRecord(
  storageID: string | undefined,
  storageRecord: Proto.IStorageRecord
): Proto.StorageItem {
  const storageItem = new Proto.StorageItem();

  const storageKeyBuffer = storageID
    ? Bytes.fromBase64(String(storageID))
    : generateStorageID();

  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const storageKey = Bytes.fromBase64(storageKeyBase64);
  const storageItemKey = deriveStorageItemKey(
    storageKey,
    Bytes.toBase64(storageKeyBuffer)
  );

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
  deleteKeys: Array<Uint8Array>;
  newItems: Set<Proto.IStorageItem>;
  storageManifest: Proto.IStorageManifest;
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
  const insertKeys: Array<string> = [];
  const deleteKeys: Array<Uint8Array> = [];
  const manifestRecordKeys: Set<IManifestRecordIdentifier> = new Set();
  const newItems: Set<Proto.IStorageItem> = new Set();

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
    const identifier = new Proto.ManifestRecord.Identifier();
    identifier.type = identifierType;

    const currentRedactedID = currentStorageID
      ? redactStorageID(currentStorageID, currentStorageVersion)
      : undefined;

    const isNewItem = isNewManifest || storageNeedsSync || !currentStorageID;

    const storageID = isNewItem
      ? Bytes.toBase64(generateStorageID())
      : currentStorageID;

    let storageItem;
    try {
      storageItem = encryptRecord(storageID, storageRecord);
    } catch (err) {
      log.error(
        `storageService.upload(${version}): encrypt record failed:`,
        Errors.toLogFormat(err)
      );
      throw err;
    }
    identifier.raw = storageItem.key;

    // When a client needs to update a given record it should create it
    // under a new key and delete the existing key.
    if (isNewItem) {
      newItems.add(storageItem);

      insertKeys.push(storageID);
      const newRedactedID = redactStorageID(storageID, version, conversation);
      if (currentStorageID) {
        log.info(
          `storageService.upload(${version}): ` +
            `updating from=${currentRedactedID} ` +
            `to=${newRedactedID}`
        );
        deleteKeys.push(Bytes.fromBase64(currentStorageID));
      } else {
        log.info(
          `storageService.upload(${version}): adding key=${newRedactedID}`
        );
      }
    }

    manifestRecordKeys.add(identifier);

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

    const conversationType = typeofConversation(conversation.attributes);
    if (conversationType === ConversationTypes.Me) {
      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.account = await toAccountRecord(conversation);
      identifierType = ITEM_TYPE.ACCOUNT;
    } else if (conversationType === ConversationTypes.Direct) {
      // Contacts must have UUID
      if (!conversation.get('uuid')) {
        continue;
      }

      const validationError = conversation.validate();
      if (validationError) {
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
            `skipping contact=${recordID} ` +
            `due to local validation error=${validationError}`
        );
        conversation.unset('storageID');
        deleteKeys.push(Bytes.fromBase64(droppedID));
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
        updateConversation(conversation.attributes);
      });
    }
  }

  const {
    storyDistributionLists,
    installedStickerPacks,
    uninstalledStickerPacks,
  } = await getNonConversationRecords();

  log.info(
    `storageService.upload(${version}): ` +
      `adding storyDistributionLists=${storyDistributionLists.length}`
  );

  storyDistributionLists.forEach(storyDistributionList => {
    const storageRecord = new Proto.StorageRecord();
    storageRecord.storyDistributionList = toStoryDistributionListRecord(
      storyDistributionList
    );

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: storyDistributionList.storageID,
      currentStorageVersion: storyDistributionList.storageVersion,
      identifierType: ITEM_TYPE.STORY_DISTRIBUTION_LIST,
      storageNeedsSync: storyDistributionList.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        dataInterface.modifyStoryDistribution({
          ...storyDistributionList,
          storageID,
          storageVersion: version,
          storageNeedsSync: false,
        });
      });
    }
  });

  log.info(
    `storageService.upload(${version}): ` +
      `adding uninstalled stickerPacks=${uninstalledStickerPacks.length}`
  );

  const uninstalledStickerPackIds = new Set<string>();

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
      postUploadUpdateFunctions.push(() => {
        dataInterface.addUninstalledStickerPack({
          ...stickerPack,
          storageID,
          storageVersion: version,
          storageNeedsSync: false,
        });
      });
    }
  });

  log.info(
    `storageService.upload(${version}): ` +
      `adding installed stickerPacks=${installedStickerPacks.length}`
  );

  installedStickerPacks.forEach(stickerPack => {
    if (uninstalledStickerPackIds.has(stickerPack.id)) {
      log.error(
        `storageService.upload(${version}): ` +
          `sticker pack ${stickerPack.id} is both installed and uninstalled`
      );
      window.reduxActions.stickers.uninstallStickerPack(
        stickerPack.id,
        stickerPack.key,
        { fromSync: true }
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
      postUploadUpdateFunctions.push(() => {
        dataInterface.createOrUpdateStickerPack({
          ...stickerPack,
          storageID,
          storageVersion: version,
          storageNeedsSync: false,
        });
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
    const identifier = new Proto.ManifestRecord.Identifier();
    identifier.type = record.itemType;
    identifier.raw = Bytes.fromBase64(record.storageID);

    manifestRecordKeys.add(identifier);
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
    const identifier = new Proto.ManifestRecord.Identifier();
    identifier.type = record.itemType;
    identifier.raw = Bytes.fromBase64(record.storageID);

    manifestRecordKeys.add(identifier);
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
    deleteKeys.push(Bytes.fromBase64(storageID));
  }

  // Validate before writing

  const rawDuplicates = new Set();
  const typeRawDuplicates = new Set();
  let hasAccountType = false;
  manifestRecordKeys.forEach(identifier => {
    // Ensure there are no duplicate StorageIdentifiers in your manifest
    //   This can be broken down into two parts:
    //     There are no duplicate type+raw pairs
    //     There are no duplicate raw bytes
    strictAssert(identifier.raw, 'manifest record key without raw identifier');
    const storageID = Bytes.toBase64(identifier.raw);
    const typeAndRaw = `${identifier.type}+${storageID}`;
    if (
      rawDuplicates.has(identifier.raw) ||
      typeRawDuplicates.has(typeAndRaw)
    ) {
      log.warn(
        `storageService.upload(${version}): removing from duplicate item ` +
          'from the manifest',
        redactStorageID(storageID),
        identifier.type
      );
      manifestRecordKeys.delete(identifier);
    }
    rawDuplicates.add(identifier.raw);
    typeRawDuplicates.add(typeAndRaw);

    // Ensure all deletes are not present in the manifest
    const hasDeleteKey = deleteKeys.find(
      key => Bytes.toBase64(key) === storageID
    );
    if (hasDeleteKey) {
      log.warn(
        `storageService.upload(${version}): removing key which has been deleted`,
        redactStorageID(storageID),
        identifier.type
      );
      manifestRecordKeys.delete(identifier);
    }

    // Ensure that there is *exactly* one Account type in the manifest
    if (identifier.type === ITEM_TYPE.ACCOUNT) {
      if (hasAccountType) {
        log.warn(
          `storageService.upload(${version}): removing duplicate account`,
          redactStorageID(storageID)
        );
        manifestRecordKeys.delete(identifier);
      }
      hasAccountType = true;
    }
  });

  rawDuplicates.clear();
  typeRawDuplicates.clear();

  const storageKeyDuplicates = new Set<string>();

  newItems.forEach(storageItem => {
    // Ensure there are no duplicate StorageIdentifiers in your list of inserts
    strictAssert(storageItem.key, 'New storage item without key');

    const storageID = Bytes.toBase64(storageItem.key);
    if (storageKeyDuplicates.has(storageID)) {
      log.warn(
        `storageService.upload(${version}): ` +
          'removing duplicate identifier from inserts',
        redactStorageID(storageID)
      );
      newItems.delete(storageItem);
    }
    storageKeyDuplicates.add(storageID);
  });

  storageKeyDuplicates.clear();

  // If we have a copy of what the current remote manifest is then we run these
  // additional validations comparing our pending manifest to the remote
  // manifest:
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
    manifestRecordKeys.forEach((identifier: IManifestRecordIdentifier) => {
      strictAssert(identifier.raw, 'Identifier without raw field');
      const storageID = Bytes.toBase64(identifier.raw);
      localKeys.add(storageID);

      if (!remoteKeys.has(storageID)) {
        pendingInserts.add(storageID);
      }
    });

    remoteKeys.forEach(storageID => {
      if (!localKeys.has(storageID)) {
        pendingDeletes.add(storageID);
      }
    });

    if (deleteKeys.length !== pendingDeletes.size) {
      const localDeletes = deleteKeys.map(key =>
        redactStorageID(Bytes.toBase64(key))
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
    if (newItems.size !== pendingInserts.size) {
      throw new Error('invalid write insert items length do not match');
    }
    deleteKeys.forEach(key => {
      const storageID = Bytes.toBase64(key);
      if (!pendingDeletes.has(storageID)) {
        throw new Error(
          'invalid write delete key missing from pending deletes'
        );
      }
    });
    insertKeys.forEach(storageID => {
      if (!pendingInserts.has(storageID)) {
        throw new Error(
          'invalid write insert key missing from pending inserts'
        );
      }
    });
  }

  const manifestRecord = new Proto.ManifestRecord();
  manifestRecord.version = Long.fromNumber(version);
  manifestRecord.sourceDevice = window.storage.user.getDeviceId() ?? 0;
  manifestRecord.keys = Array.from(manifestRecordKeys);

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
    postUploadUpdateFunctions,
    deleteKeys,
    newItems,
    storageManifest,
  };
}

async function uploadManifest(
  version: number,
  {
    postUploadUpdateFunctions,
    deleteKeys,
    newItems,
    storageManifest,
  }: GeneratedManifestType
): Promise<void> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.uploadManifest: We are offline!');
  }

  if (newItems.size === 0 && deleteKeys.length === 0) {
    log.info(`storageService.upload(${version}): nothing to upload`);
    return;
  }

  const credentials = window.storage.get('storageCredentials');
  try {
    log.info(
      `storageService.upload(${version}): inserting=${newItems.size} ` +
        `deleting=${deleteKeys.length}`
    );

    const writeOperation = new Proto.WriteOperation();
    writeOperation.manifest = storageManifest;
    writeOperation.insertItem = Array.from(newItems);
    writeOperation.deleteKey = deleteKeys;

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
  window.storage.put('manifestVersion', version);
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

  const { postUploadUpdateFunctions, newItems, storageManifest } =
    await generateManifest(version, undefined, true);

  await uploadManifest(version, {
    postUploadUpdateFunctions,
    // we have created a new manifest, there should be no keys to delete
    deleteKeys: [],
    newItems,
    storageManifest,
  });
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
    window.storage.put('storageCredentials', credentials);

    const manifestBinary = await window.textsecure.messaging.getStorageManifest(
      {
        credentials,
        greaterThanVersion: manifestVersion,
      }
    );
    const encryptedManifest = Proto.StorageManifest.decode(manifestBinary);

    try {
      return decryptManifest(encryptedManifest);
    } catch (err) {
      await stopStorageServiceSync(err);
      return;
    }
  } catch (err) {
    if (err.code === 204) {
      log.info('storageService.sync: no newer manifest, ok');
      return;
    }

    log.error('storageService.sync: failed!', Errors.toLogFormat(err));

    if (err.code === 404) {
      await createNewManifest();
      return;
    }

    throw err;
  }
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

  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;

  let mergeResult: MergeResultType = { hasConflict: false, details: [] };
  let isUnsupported = false;
  let hasError = false;
  let updatedConversations = new Array<ConversationModel>();
  const needProfileFetch = new Array<ConversationModel>();

  try {
    if (itemType === ITEM_TYPE.UNKNOWN) {
      log.warn('storageService.mergeRecord: Unknown item type', storageID);
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
    } else {
      isUnsupported = true;
      log.warn(
        `storageService.merge(${redactStorageID(
          storageID,
          storageVersion
        )}): unknown item type=${itemType}`
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
  installedStickerPacks: ReadonlyArray<StickerPackType>;
  uninstalledStickerPacks: ReadonlyArray<UninstalledStickerPackType>;
  storyDistributionLists: ReadonlyArray<StoryDistributionWithMembersType>;
}>;

// TODO: DESKTOP-3929
async function getNonConversationRecords(): Promise<NonConversationRecordsResultType> {
  const [
    storyDistributionLists,
    uninstalledStickerPacks,
    installedStickerPacks,
  ] = await Promise.all([
    dataInterface.getAllStoryDistributionsWithMembers(),
    dataInterface.getUninstalledStickerPacks(),
    dataInterface.getInstalledStickerPacks(),
  ]);

  return {
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
    conflictCount = await processRemoteRecords(version, remoteOnlyRecords);
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
      log.info(
        `storageService.process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );
      conversation.unset('storageID');
      conversation.unset('storageVersion');
      updateConversation(conversation.attributes);
    }
  });

  // Refetch various records post-merge
  {
    const {
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
      dataInterface.addUninstalledStickerPack({
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
      dataInterface.createOrUpdateStickerPack({
        ...stickerPack,
        storageID: undefined,
        storageVersion: undefined,
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
      dataInterface.modifyStoryDistribution({
        ...storyDistributionList,
        storageID: undefined,
        storageVersion: undefined,
      });
    });

    // Check to make sure we have a "My Stories" distribution list set up
    const myStories = storyDistributionLists.find(
      ({ id }) => id === MY_STORIES_ID
    );

    if (!myStories) {
      const storyDistribution: StoryDistributionWithMembersType = {
        allowsReplies: true,
        id: MY_STORIES_ID,
        isBlockList: true,
        members: [],
        name: MY_STORIES_ID,
        senderKeyInfo: undefined,
        storageNeedsSync: true,
      };

      await dataInterface.createNewStoryDistribution(storyDistribution);

      const shouldSave = false;
      window.reduxActions.storyDistributionLists.createDistributionList(
        storyDistribution.name,
        storyDistribution.members,
        storyDistribution,
        shouldSave
      );

      conflictCount += 1;
    }
  }

  log.info(
    `storageService.process(${version}): conflictCount=${conflictCount}`
  );

  return conflictCount;
}

async function processRemoteRecords(
  storageVersion: number,
  remoteOnlyRecords: Map<string, RemoteRecord>
): Promise<number> {
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
    `storageService.process(${storageVersion}): fetching remote keys ` +
      `count=${remoteOnlyRecords.size}`
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

  const decryptedStorageItems = await pMap(
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

      const storageItemKey = deriveStorageItemKey(storageKey, base64ItemID);

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
        throw new Error(
          "Got a remote record that wasn't requested with " +
            `storageID: ${base64ItemID}`
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
    `storageService.process(${storageVersion}): missing remote ` +
      `keys=${JSON.stringify(redactedMissingKeys)} ` +
      `count=${missingKeys.size}`
  );

  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;
  const droppedKeys = new Set<string>();

  // Drop all GV1 records for which we have GV2 record in the same manifest
  const masterKeys = new Map<string, string>();
  for (const { itemType, storageID, storageRecord } of decryptedStorageItems) {
    if (itemType === ITEM_TYPE.GROUPV2 && storageRecord.groupV2?.masterKey) {
      masterKeys.set(
        Bytes.toBase64(storageRecord.groupV2.masterKey),
        storageID
      );
    }
  }

  let accountItem: MergeableItemType | undefined;

  const prunedStorageItems = decryptedStorageItems.filter(item => {
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

    const mergedRecords = [
      ...(await pMap(
        prunedStorageItems,
        (item: MergeableItemType) => mergeRecord(storageVersion, item),
        { concurrency: 32 }
      )),

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
    needProfileFetch.map(convo => convo.getProfiles());

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

async function sync(
  ignoreConflicts = false
): Promise<Proto.ManifestRecord | undefined> {
  if (!window.storage.get('storageKey')) {
    throw new Error('storageService.sync: Cannot start; no storage key!');
  }

  log.info(
    `storageService.sync: starting... ignoreConflicts=${ignoreConflicts}`
  );

  let manifest: Proto.ManifestRecord | undefined;
  try {
    // If we've previously interacted with strage service, update 'fetchComplete' record
    const previousFetchComplete = window.storage.get('storageFetchComplete');
    const manifestFromStorage = window.storage.get('manifestVersion');
    if (!previousFetchComplete && isNumber(manifestFromStorage)) {
      window.storage.put('storageFetchComplete', true);
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

    strictAssert(
      manifest.version !== undefined && manifest.version !== null,
      'Manifest without version'
    );
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

    const hasConflicts = conflictCount !== 0;
    if (hasConflicts && !ignoreConflicts) {
      await upload(true);
    }

    // We now know that we've successfully completed a storage service fetch
    await window.storage.put('storageFetchComplete', true);
  } catch (err) {
    log.error(
      'storageService.sync: error processing manifest',
      Errors.toLogFormat(err)
    );
  }

  log.info('storageService.sync: complete');
  return manifest;
}

async function upload(fromSync = false): Promise<void> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.upload: We are offline!');
  }

  // Rate limit uploads coming from syncing
  if (fromSync) {
    uploadBucket.push(Date.now());
    if (uploadBucket.length >= 3) {
      const [firstMostRecentWrite] = uploadBucket;

      if (isMoreRecentThan(5 * durations.MINUTE, firstMostRecentWrite)) {
        throw new Error(
          'storageService.uploadManifest: too many writes too soon.'
        );
      }

      uploadBucket.shift();
    }
  }

  if (!window.storage.get('storageKey')) {
    // requesting new keys runs the sync job which will detect the conflict
    // and re-run the upload job once we're merged and up-to-date.
    log.info('storageService.upload: no storageKey, requesting new keys');
    backOff.reset();

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'storageService.upload: We are primary device; not sending key sync request'
      );
      return;
    }

    try {
      await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
    } catch (error) {
      log.error(
        'storageService.upload: Failed to queue sync message',
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
    previousManifest = await sync(ignoreConflicts);
  }

  const localManifestVersion = window.storage.get('manifestVersion', 0);
  const version = Number(localManifestVersion) + 1;

  log.info(
    `storageService.upload(${version}): will update to manifest version`
  );

  try {
    const generatedManifest = await generateManifest(
      version,
      previousManifest,
      false
    );
    await uploadManifest(version, generatedManifest);

    // Clear pending delete keys after successful upload
    await window.storage.put('storage-service-pending-deletes', []);
  } catch (err) {
    if (err.code === 409) {
      await sleep(conflictBackOff.getAndIncrement());
      log.info('storageService.upload: pushing sync on the queue');
      // The sync job will check for conflicts and as part of that conflict
      // check if an item needs sync and doesn't match with the remote record
      // it'll kick off another upload.
      setTimeout(runStorageServiceSyncJob);
      return;
    }
    log.error(
      `storageService.upload(${version}): error`,
      Errors.toLogFormat(err)
    );
  }
}

let storageServiceEnabled = false;

export function enableStorageService(): void {
  storageServiceEnabled = true;
}

// Note: this function is meant to be called before ConversationController is hydrated.
//   It goes directly to the database, so in-memory conversations will be out of date.
export async function eraseAllStorageServiceState({
  keepUnknownFields = false,
}: { keepUnknownFields?: boolean } = {}): Promise<void> {
  log.info('storageService.eraseAllStorageServiceState: starting...');
  await Promise.all([
    window.storage.remove('manifestVersion'),
    keepUnknownFields
      ? Promise.resolve()
      : window.storage.remove('storage-service-unknown-records'),
    window.storage.remove('storageCredentials'),
  ]);
  await eraseStorageServiceStateFromConversations();
  log.info('storageService.eraseAllStorageServiceState: complete');
}

export const storageServiceUploadJob = debounce(() => {
  if (!storageServiceEnabled) {
    log.info('storageService.storageServiceUploadJob: called before enabled');
    return;
  }

  storageJobQueue(async () => {
    await upload();
  }, `upload v${window.storage.get('manifestVersion')}`);
}, 500);

export const runStorageServiceSyncJob = debounce(() => {
  if (!storageServiceEnabled) {
    log.info('storageService.runStorageServiceSyncJob: called before enabled');
    return;
  }

  ourProfileKeyService.blockGetWithPromise(
    storageJobQueue(async () => {
      await sync();

      // Notify listeners about sync completion
      window.Whisper.events.trigger('storageService:syncComplete');
    }, `sync v${window.storage.get('manifestVersion')}`)
  );
}, 500);
