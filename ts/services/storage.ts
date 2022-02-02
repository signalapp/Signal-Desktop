// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, isNumber } from 'lodash';
import pMap from 'p-map';

import dataInterface from '../sql/Client';
import * as Bytes from '../Bytes';
import {
  getRandomBytes,
  deriveStorageItemKey,
  deriveStorageManifestKey,
  encryptProfile,
  decryptProfile,
} from '../Crypto';
import {
  mergeAccountRecord,
  mergeContactRecord,
  mergeGroupV1Record,
  mergeGroupV2Record,
  toAccountRecord,
  toContactRecord,
  toGroupV1Record,
  toGroupV2Record,
} from './storageRecordOps';
import type { ConversationModel } from '../models/conversations';
import { strictAssert } from '../util/assert';
import * as durations from '../util/durations';
import { BackOff } from '../util/BackOff';
import { storageJobQueue } from '../util/JobQueue';
import { sleep } from '../util/sleep';
import { isMoreRecentThan } from '../util/timestamp';
import { normalizeNumber } from '../util/normalizeNumber';
import { ourProfileKeyService } from './ourProfileKey';
import {
  ConversationTypes,
  typeofConversation,
} from '../util/whatTypeOfConversation';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import * as Errors from '../types/errors';

type IManifestRecordIdentifier = Proto.ManifestRecord.IIdentifier;

const { eraseStorageServiceStateFromConversations, updateConversation } =
  dataInterface;

const uploadBucket: Array<number> = [];

const validRecordTypes = new Set([
  0, // UNKNOWN
  1, // CONTACT
  2, // GROUPV1
  3, // GROUPV2
  4, // ACCOUNT
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

function redactStorageID(storageID: string): string {
  return storageID.substring(0, 3);
}

type RemoteRecord = {
  itemType: number;
  storageID: string;
};

type UnknownRecord = RemoteRecord;

async function encryptRecord(
  storageID: string | undefined,
  storageRecord: Proto.IStorageRecord
): Promise<Proto.StorageItem> {
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
  conversationsToUpdate: Array<{
    conversation: ConversationModel;
    storageID: string | undefined;
  }>;
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
    'storageService.generateManifest: generating manifest',
    version,
    isNewManifest
  );

  await window.ConversationController.checkForConflicts();

  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;

  const conversationsToUpdate = [];
  const insertKeys: Array<string> = [];
  const deleteKeys: Array<Uint8Array> = [];
  const manifestRecordKeys: Set<IManifestRecordIdentifier> = new Set();
  const newItems: Set<Proto.IStorageItem> = new Set();

  const conversations = window.getConversations();
  for (let i = 0; i < conversations.length; i += 1) {
    const conversation = conversations.models[i];
    const identifier = new Proto.ManifestRecord.Identifier();

    let storageRecord;

    const conversationType = typeofConversation(conversation.attributes);
    if (conversationType === ConversationTypes.Me) {
      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.account = await toAccountRecord(conversation);
      identifier.type = ITEM_TYPE.ACCOUNT;
    } else if (conversationType === ConversationTypes.Direct) {
      // Contacts must have UUID
      if (!conversation.get('uuid')) {
        continue;
      }

      const validationError = conversation.validate();
      if (validationError) {
        if (conversation.get('storageID')) {
          log.warn(
            'storageService.generateManifest: skipping contact',
            conversation.idForLogging(),
            'due to local validation error',
            validationError
          );
          conversation.unset('storageID');
        }
        continue;
      }

      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.contact = await toContactRecord(conversation);
      identifier.type = ITEM_TYPE.CONTACT;
    } else if (conversationType === ConversationTypes.GroupV2) {
      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.groupV2 = await toGroupV2Record(conversation);
      identifier.type = ITEM_TYPE.GROUPV2;
    } else if (conversationType === ConversationTypes.GroupV1) {
      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.groupV1 = await toGroupV1Record(conversation);
      identifier.type = ITEM_TYPE.GROUPV1;
    } else {
      log.info(
        'storageService.generateManifest: unknown conversation',
        conversation.idForLogging()
      );
    }

    if (storageRecord) {
      const currentStorageID = conversation.get('storageID');

      const isNewItem =
        isNewManifest ||
        Boolean(conversation.get('needsStorageServiceSync')) ||
        !currentStorageID;

      const storageID = isNewItem
        ? Bytes.toBase64(generateStorageID())
        : currentStorageID;

      let storageItem;
      try {
        // eslint-disable-next-line no-await-in-loop
        storageItem = await encryptRecord(storageID, storageRecord);
      } catch (err) {
        log.error(
          'storageService.generateManifest: encrypt record failed:',
          err && err.stack ? err.stack : String(err)
        );
        throw err;
      }
      identifier.raw = storageItem.key;

      // When a client needs to update a given record it should create it
      // under a new key and delete the existing key.
      if (isNewItem) {
        newItems.add(storageItem);

        if (storageID) {
          insertKeys.push(storageID);
          log.info(
            'storageService.generateManifest: new key',
            conversation.idForLogging(),
            redactStorageID(storageID)
          );
        } else {
          log.info(
            'storageService.generateManifest: no storage id',
            conversation.idForLogging()
          );
        }

        const oldStorageID = conversation.get('storageID');
        if (oldStorageID) {
          log.info(
            'storageService.generateManifest: deleting key',
            redactStorageID(oldStorageID)
          );
          deleteKeys.push(Bytes.fromBase64(oldStorageID));
        }

        conversationsToUpdate.push({
          conversation,
          storageID,
        });
      }

      manifestRecordKeys.add(identifier);
    }
  }

  const unknownRecordsArray: ReadonlyArray<UnknownRecord> = (
    window.storage.get('storage-service-unknown-records') || []
  ).filter((record: UnknownRecord) => !validRecordTypes.has(record.itemType));

  log.info(
    'storageService.generateManifest: adding unknown records:',
    unknownRecordsArray.length
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

  log.info(
    'storageService.generateManifest: adding records that had errors in the previous merge',
    recordsWithErrors.length
  );

  // These records failed to merge in the previous fetchManifest, but we still
  // need to include them so that the manifest is complete
  recordsWithErrors.forEach((record: UnknownRecord) => {
    const identifier = new Proto.ManifestRecord.Identifier();
    identifier.type = record.itemType;
    identifier.raw = Bytes.fromBase64(record.storageID);

    manifestRecordKeys.add(identifier);
  });

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
      log.info(
        'storageService.generateManifest: removing duplicate identifier from manifest',
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
      log.info(
        'storageService.generateManifest: removing key which has been deleted',
        identifier.type
      );
      manifestRecordKeys.delete(identifier);
    }

    // Ensure that there is *exactly* one Account type in the manifest
    if (identifier.type === ITEM_TYPE.ACCOUNT) {
      if (hasAccountType) {
        log.info('storageService.generateManifest: removing duplicate account');
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
      log.info(
        'storageService.generateManifest: removing duplicate identifier from inserts',
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
        'Delete key sizes do not match',
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
  manifestRecord.version = version;
  manifestRecord.keys = Array.from(manifestRecordKeys);

  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const storageKey = Bytes.fromBase64(storageKeyBase64);
  const storageManifestKey = deriveStorageManifestKey(storageKey, version);
  const encryptedManifest = encryptProfile(
    Proto.ManifestRecord.encode(manifestRecord).finish(),
    storageManifestKey
  );

  const storageManifest = new Proto.StorageManifest();
  storageManifest.version = version;
  storageManifest.value = encryptedManifest;

  return {
    conversationsToUpdate,
    deleteKeys,
    newItems,
    storageManifest,
  };
}

async function uploadManifest(
  version: number,
  {
    conversationsToUpdate,
    deleteKeys,
    newItems,
    storageManifest,
  }: GeneratedManifestType
): Promise<void> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.uploadManifest: We are offline!');
  }

  if (newItems.size === 0 && deleteKeys.length === 0) {
    log.info('storageService.uploadManifest: nothing to upload');
    return;
  }

  const credentials = window.storage.get('storageCredentials');
  try {
    log.info(
      'storageService.uploadManifest: keys inserting, deleting:',
      newItems.size,
      deleteKeys.length
    );

    const writeOperation = new Proto.WriteOperation();
    writeOperation.manifest = storageManifest;
    writeOperation.insertItem = Array.from(newItems);
    writeOperation.deleteKey = deleteKeys;

    log.info('storageService.uploadManifest: uploading...', version);
    await window.textsecure.messaging.modifyStorageRecords(
      Proto.WriteOperation.encode(writeOperation).finish(),
      {
        credentials,
      }
    );

    log.info(
      'storageService.uploadManifest: upload done, updating conversation(s) with new storageIDs:',
      conversationsToUpdate.length
    );

    // update conversations with the new storageID
    conversationsToUpdate.forEach(({ conversation, storageID }) => {
      conversation.set({
        needsStorageServiceSync: false,
        storageID,
      });
      updateConversation(conversation.attributes);
    });
  } catch (err) {
    log.error(
      'storageService.uploadManifest: failed!',
      err && err.stack ? err.stack : String(err)
    );

    if (err.code === 409) {
      if (conflictBackOff.isFull()) {
        log.error(
          'storageService.uploadManifest: Exceeded maximum consecutive conflicts'
        );
        return;
      }

      log.info(
        `storageService.uploadManifest: Conflict found with v${version}, running sync job times(${conflictBackOff.getIndex()})`
      );

      throw err;
    }

    throw err;
  }

  log.info(
    'storageService.uploadManifest: setting new manifestVersion',
    version
  );
  window.storage.put('manifestVersion', version);
  conflictBackOff.reset();
  backOff.reset();

  if (window.ConversationController.areWePrimaryDevice()) {
    log.warn(
      'storageService.uploadManifest: We are primary device; not sending sync manifest'
    );
    return;
  }

  try {
    await singleProtoJobQueue.add(
      window.textsecure.messaging.getFetchManifestSyncMessage()
    );
  } catch (error) {
    log.error(
      'storageService.uploadManifest: Failed to queue sync message',
      Errors.toLogFormat(error)
    );
  }
}

async function stopStorageServiceSync() {
  log.info('storageService.stopStorageServiceSync');

  await window.storage.remove('storageKey');

  if (backOff.isFull()) {
    log.info(
      'storageService.stopStorageServiceSync: too many consecutive stops'
    );
    return;
  }

  await sleep(backOff.getAndIncrement());
  log.info('storageService.stopStorageServiceSync: requesting new keys');
  setTimeout(async () => {
    if (!window.textsecure.messaging) {
      throw new Error('storageService.stopStorageServiceSync: We are offline!');
    }

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'stopStorageServiceSync: We are primary device; not sending key sync request'
      );
      return;
    }
    try {
      await singleProtoJobQueue.add(
        window.textsecure.messaging.getRequestKeySyncMessage()
      );
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

  const { conversationsToUpdate, newItems, storageManifest } =
    await generateManifest(version, undefined, true);

  await uploadManifest(version, {
    conversationsToUpdate,
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
    normalizeNumber(version ?? 0)
  );

  strictAssert(value, 'StorageManifest has no value field');
  const decryptedManifest = decryptProfile(value, storageManifestKey);

  return Proto.ManifestRecord.decode(decryptedManifest);
}

async function fetchManifest(
  manifestVersion: number
): Promise<Proto.ManifestRecord | undefined> {
  log.info('storageService.fetchManifest');

  if (!window.textsecure.messaging) {
    throw new Error('storageService.fetchManifest: We are offline!');
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

    // if we don't get a value we're assuming that there's no newer manifest
    if (!encryptedManifest.value || !encryptedManifest.version) {
      log.info('storageService.fetchManifest: nothing changed');
      return;
    }

    try {
      return decryptManifest(encryptedManifest);
    } catch (err) {
      await stopStorageServiceSync();
      return;
    }
  } catch (err) {
    if (err.code === 204) {
      log.info('storageService.fetchManifest: no newer manifest, ok');
      return;
    }

    log.error(
      'storageService.fetchManifest: failed!',
      err && err.stack ? err.stack : String(err)
    );

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
  hasError: boolean;
  isUnsupported: boolean;
};

async function mergeRecord(
  itemToMerge: MergeableItemType
): Promise<MergedRecordType> {
  const { itemType, storageID, storageRecord } = itemToMerge;

  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;

  let hasConflict = false;
  let isUnsupported = false;
  let hasError = false;

  try {
    if (itemType === ITEM_TYPE.UNKNOWN) {
      log.info('storageService.mergeRecord: Unknown item type', storageID);
    } else if (itemType === ITEM_TYPE.CONTACT && storageRecord.contact) {
      hasConflict = await mergeContactRecord(storageID, storageRecord.contact);
    } else if (itemType === ITEM_TYPE.GROUPV1 && storageRecord.groupV1) {
      hasConflict = await mergeGroupV1Record(storageID, storageRecord.groupV1);
    } else if (itemType === ITEM_TYPE.GROUPV2 && storageRecord.groupV2) {
      hasConflict = await mergeGroupV2Record(storageID, storageRecord.groupV2);
    } else if (itemType === ITEM_TYPE.ACCOUNT && storageRecord.account) {
      hasConflict = await mergeAccountRecord(storageID, storageRecord.account);
    } else {
      isUnsupported = true;
      log.info('storageService.mergeRecord: Unknown record:', itemType);
    }
    log.info(
      'storageService.mergeRecord: merged',
      redactStorageID(storageID),
      itemType,
      hasConflict
    );
  } catch (err) {
    hasError = true;
    log.error(
      'storageService.mergeRecord: Error with',
      redactStorageID(storageID),
      itemType,
      String(err)
    );
  }

  return {
    hasConflict,
    hasError,
    isUnsupported,
    itemType,
    storageID,
  };
}

async function processManifest(
  manifest: Proto.IManifestRecord
): Promise<boolean> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.processManifest: We are offline!');
  }

  const remoteKeysTypeMap = new Map();
  (manifest.keys || []).forEach(({ raw, type }: IManifestRecordIdentifier) => {
    strictAssert(raw, 'Identifier without raw field');
    remoteKeysTypeMap.set(Bytes.toBase64(raw), type);
  });

  const remoteKeys = new Set(remoteKeysTypeMap.keys());
  const localKeys: Set<string> = new Set();

  const conversations = window.getConversations();
  conversations.forEach((conversation: ConversationModel) => {
    const storageID = conversation.get('storageID');
    if (storageID) {
      localKeys.add(storageID);
    }
  });

  const unknownRecordsArray: ReadonlyArray<UnknownRecord> =
    window.storage.get('storage-service-unknown-records') || [];

  const stillUnknown = unknownRecordsArray.filter((record: UnknownRecord) => {
    // Do not include any unknown records that we already support
    if (!validRecordTypes.has(record.itemType)) {
      localKeys.add(record.storageID);
      return false;
    }
    return true;
  });

  log.info(
    'storageService.processManifest: local records:',
    conversations.length
  );
  log.info('storageService.processManifest: local keys:', localKeys.size);
  log.info(
    'storageService.processManifest: unknown records:',
    stillUnknown.length
  );
  log.info('storageService.processManifest: remote keys:', remoteKeys.size);

  const remoteOnlySet: Set<string> = new Set();
  remoteKeys.forEach((key: string) => {
    if (!localKeys.has(key)) {
      remoteOnlySet.add(key);
    }
  });

  log.info(
    'storageService.processManifest: remote ids:',
    Array.from(remoteOnlySet).map(redactStorageID).join(',')
  );

  const remoteOnlyRecords = new Map<string, RemoteRecord>();
  remoteOnlySet.forEach(storageID => {
    remoteOnlyRecords.set(storageID, {
      storageID,
      itemType: remoteKeysTypeMap.get(storageID),
    });
  });

  if (!remoteOnlyRecords.size) {
    return false;
  }

  const conflictCount = await processRemoteRecords(remoteOnlyRecords);

  // Post-merge, if our local records contain any storage IDs that were not
  // present in the remote manifest then we'll need to clear it, generate a
  // new storageID for that record, and upload.
  // This might happen if a device pushes a manifest which doesn't contain
  // the keys that we have in our local database.
  window.getConversations().forEach((conversation: ConversationModel) => {
    const storageID = conversation.get('storageID');
    if (storageID && !remoteKeys.has(storageID)) {
      log.info(
        'storageService.processManifest: local key was not in remote manifest',
        redactStorageID(storageID),
        conversation.idForLogging()
      );
      conversation.unset('storageID');
      updateConversation(conversation.attributes);
    }
  });

  return conflictCount !== 0;
}

async function processRemoteRecords(
  remoteOnlyRecords: Map<string, RemoteRecord>
): Promise<number> {
  const storageKeyBase64 = window.storage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }
  const storageKey = Bytes.fromBase64(storageKeyBase64);

  log.info(
    'storageService.processRemoteRecords: remote only keys',
    remoteOnlyRecords.size
  );

  const readOperation = new Proto.ReadOperation();
  readOperation.readKey = Array.from(remoteOnlyRecords.keys()).map(
    Bytes.fromBase64
  );

  const credentials = window.storage.get('storageCredentials');
  const storageItemsBuffer =
    await window.textsecure.messaging.getStorageRecords(
      Proto.ReadOperation.encode(readOperation).finish(),
      {
        credentials,
      }
    );

  const storageItems = Proto.StorageItems.decode(storageItemsBuffer);

  if (!storageItems.items) {
    log.info('storageService.processRemoteRecords: No storage items retrieved');
    return 0;
  }

  const decryptedStorageItems = await pMap(
    storageItems.items,
    async (
      storageRecordWrapper: Proto.IStorageItem
    ): Promise<MergeableItemType> => {
      const { key, value: storageItemCiphertext } = storageRecordWrapper;

      if (!key || !storageItemCiphertext) {
        log.error(
          'storageService.processRemoteRecords: No key or Ciphertext available'
        );
        await stopStorageServiceSync();
        throw new Error(
          'storageService.processRemoteRecords: Missing key and/or Ciphertext'
        );
      }

      const base64ItemID = Bytes.toBase64(key);

      const storageItemKey = deriveStorageItemKey(storageKey, base64ItemID);

      let storageItemPlaintext;
      try {
        storageItemPlaintext = decryptProfile(
          storageItemCiphertext,
          storageItemKey
        );
      } catch (err) {
        log.error(
          'storageService.processRemoteRecords: Error decrypting storage item'
        );
        await stopStorageServiceSync();
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

  // Merge Account records last since it contains the pinned conversations
  // and we need all other records merged first before we can find the pinned
  // records in our db
  const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;
  const sortedStorageItems = decryptedStorageItems.sort((_, b) =>
    b.itemType === ITEM_TYPE.ACCOUNT ? -1 : 1
  );

  try {
    log.info(
      `storageService.processRemoteRecords: Attempting to merge ${sortedStorageItems.length} records`
    );
    const mergedRecords = await pMap(sortedStorageItems, mergeRecord, {
      concurrency: 5,
    });
    log.info(
      `storageService.processRemoteRecords: Processed ${mergedRecords.length} records`
    );

    // Collect full map of previously and currently unknown records
    const unknownRecords: Map<string, UnknownRecord> = new Map();

    const unknownRecordsArray: ReadonlyArray<UnknownRecord> =
      window.storage.get(
        'storage-service-unknown-records',
        new Array<UnknownRecord>()
      );
    unknownRecordsArray.forEach((record: UnknownRecord) => {
      unknownRecords.set(record.storageID, record);
    });

    const newRecordsWithErrors: Array<UnknownRecord> = [];

    let conflictCount = 0;

    mergedRecords.forEach((mergedRecord: MergedRecordType) => {
      if (mergedRecord.isUnsupported) {
        unknownRecords.set(mergedRecord.storageID, {
          itemType: mergedRecord.itemType,
          storageID: mergedRecord.storageID,
        });
      } else if (mergedRecord.hasError) {
        newRecordsWithErrors.push({
          itemType: mergedRecord.itemType,
          storageID: mergedRecord.storageID,
        });
      }

      if (mergedRecord.hasConflict) {
        conflictCount += 1;
      }
    });

    // Filter out all the unknown records we're already supporting
    const newUnknownRecords = Array.from(unknownRecords.values()).filter(
      (record: UnknownRecord) => !validRecordTypes.has(record.itemType)
    );

    log.info(
      'storageService.processRemoteRecords: Unknown records found:',
      newUnknownRecords.length
    );
    window.storage.put('storage-service-unknown-records', newUnknownRecords);

    log.info(
      'storageService.processRemoteRecords: Records with errors:',
      newRecordsWithErrors.length
    );
    // Refresh the list of records that had errors with every push, that way
    // this list doesn't grow unbounded and we keep the list of storage keys
    // fresh.
    window.storage.put('storage-service-error-records', newRecordsWithErrors);

    if (conflictCount !== 0) {
      log.info(
        'storageService.processRemoteRecords: ' +
          `${conflictCount} conflicts found, uploading changes`
      );

      return conflictCount;
    }

    conflictBackOff.reset();
  } catch (err) {
    log.error(
      'storageService.processRemoteRecords: failed!',
      err && err.stack ? err.stack : String(err)
    );
  }

  return 0;
}

async function sync(
  ignoreConflicts = false
): Promise<Proto.ManifestRecord | undefined> {
  if (!window.storage.get('storageKey')) {
    throw new Error('storageService.sync: Cannot start; no storage key!');
  }

  log.info('storageService.sync: starting...');

  let manifest: Proto.ManifestRecord | undefined;
  try {
    // If we've previously interacted with strage service, update 'fetchComplete' record
    const previousFetchComplete = window.storage.get('storageFetchComplete');
    const manifestFromStorage = window.storage.get('manifestVersion');
    if (!previousFetchComplete && isNumber(manifestFromStorage)) {
      window.storage.put('storageFetchComplete', true);
    }

    const localManifestVersion = manifestFromStorage || 0;

    log.info(`storageService.sync: fetching ${localManifestVersion}`);
    manifest = await fetchManifest(localManifestVersion);

    // Guarding against no manifests being returned, everything should be ok
    if (!manifest) {
      log.info('storageService.sync: no new manifest');
      return undefined;
    }

    strictAssert(
      manifest.version !== undefined && manifest.version !== null,
      'Manifest without version'
    );
    const version = normalizeNumber(manifest.version);

    log.info(
      `storageService.sync: manifest versions - previous: ${localManifestVersion}, current: ${version}`
    );

    const hasConflicts = await processManifest(manifest);

    log.info(`storageService.sync: storing new manifest version ${version}`);

    window.storage.put('manifestVersion', version);

    if (hasConflicts && !ignoreConflicts) {
      await upload(true);
    }

    // We now know that we've successfully completed a storage service fetch
    window.storage.put('storageFetchComplete', true);
  } catch (err) {
    log.error(
      'storageService.sync: error processing manifest',
      err && err.stack ? err.stack : String(err)
    );
  }

  window.Signal.Util.postLinkExperience.stop();
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
      await singleProtoJobQueue.add(
        window.textsecure.messaging.getRequestKeySyncMessage()
      );
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

  log.info('storageService.upload: will update to manifest version', version);

  try {
    const generatedManifest = await generateManifest(version, previousManifest);
    await uploadManifest(version, generatedManifest);
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
      'storageService.upload',
      err && err.stack ? err.stack : String(err)
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
    }, `sync v${window.storage.get('manifestVersion')}`)
  );
}, 500);
