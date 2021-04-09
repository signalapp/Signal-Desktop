// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, isNumber } from 'lodash';
import pMap from 'p-map';

import Crypto from '../textsecure/Crypto';
import dataInterface from '../sql/Client';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveStorageItemKey,
  deriveStorageManifestKey,
} from '../Crypto';
import {
  ManifestRecordClass,
  ManifestRecordIdentifierClass,
  StorageItemClass,
  StorageManifestClass,
  StorageRecordClass,
} from '../textsecure.d';
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
import { ConversationModel } from '../models/conversations';
import { storageJobQueue } from '../util/JobQueue';
import { sleep } from '../util/sleep';
import { isMoreRecentThan } from '../util/timestamp';
import { isStorageWriteFeatureEnabled } from '../storage/isFeatureEnabled';

const {
  eraseStorageServiceStateFromConversations,
  updateConversation,
} = dataInterface;

let consecutiveStops = 0;
let consecutiveConflicts = 0;
const uploadBucket: Array<number> = [];

const validRecordTypes = new Set([
  0, // UNKNOWN
  1, // CONTACT
  2, // GROUPV1
  3, // GROUPV2
  4, // ACCOUNT
]);

type BackoffType = {
  [key: number]: number | undefined;
  max: number;
};
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const BACKOFF: BackoffType = {
  0: SECOND,
  1: 5 * SECOND,
  2: 30 * SECOND,
  3: 2 * MINUTE,
  max: 5 * MINUTE,
};

function backOff(count: number) {
  const ms = BACKOFF[count] || BACKOFF.max;
  return sleep(ms);
}

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
  storageRecord: StorageRecordClass
): Promise<StorageItemClass> {
  const storageItem = new window.textsecure.protobuf.StorageItem();

  const storageKeyBuffer = storageID
    ? base64ToArrayBuffer(String(storageID))
    : generateStorageID();

  const storageKeyBase64 = window.storage.get('storageKey');
  const storageKey = base64ToArrayBuffer(storageKeyBase64);
  const storageItemKey = await deriveStorageItemKey(
    storageKey,
    arrayBufferToBase64(storageKeyBuffer)
  );

  const encryptedRecord = await Crypto.encryptProfile(
    storageRecord.toArrayBuffer(),
    storageItemKey
  );

  storageItem.key = storageKeyBuffer;
  storageItem.value = encryptedRecord;

  return storageItem;
}

function generateStorageID(): ArrayBuffer {
  return Crypto.getRandomBytes(16);
}

type GeneratedManifestType = {
  conversationsToUpdate: Array<{
    conversation: ConversationModel;
    storageID: string | undefined;
  }>;
  deleteKeys: Array<ArrayBuffer>;
  newItems: Set<StorageItemClass>;
  storageManifest: StorageManifestClass;
};

async function generateManifest(
  version: number,
  previousManifest?: ManifestRecordClass,
  isNewManifest = false
): Promise<GeneratedManifestType> {
  window.log.info(
    'storageService.generateManifest: generating manifest',
    version,
    isNewManifest
  );

  await window.ConversationController.checkForConflicts();

  const ITEM_TYPE = window.textsecure.protobuf.ManifestRecord.Identifier.Type;

  const conversationsToUpdate = [];
  const insertKeys: Array<string> = [];
  const deleteKeys: Array<ArrayBuffer> = [];
  const manifestRecordKeys: Set<ManifestRecordIdentifierClass> = new Set();
  const newItems: Set<StorageItemClass> = new Set();

  const conversations = window.getConversations();
  for (let i = 0; i < conversations.length; i += 1) {
    const conversation = conversations.models[i];
    const identifier = new window.textsecure.protobuf.ManifestRecord.Identifier();

    let storageRecord;
    if (conversation.isMe()) {
      storageRecord = new window.textsecure.protobuf.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.account = await toAccountRecord(conversation);
      identifier.type = ITEM_TYPE.ACCOUNT;
    } else if (conversation.isPrivate()) {
      storageRecord = new window.textsecure.protobuf.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.contact = await toContactRecord(conversation);
      identifier.type = ITEM_TYPE.CONTACT;
    } else if (conversation.isGroupV2()) {
      storageRecord = new window.textsecure.protobuf.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.groupV2 = await toGroupV2Record(conversation);
      identifier.type = ITEM_TYPE.GROUPV2;
    } else if (conversation.isGroupV1()) {
      storageRecord = new window.textsecure.protobuf.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.groupV1 = await toGroupV1Record(conversation);
      identifier.type = ITEM_TYPE.GROUPV1;
    } else {
      window.log.info(
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
        ? arrayBufferToBase64(generateStorageID())
        : currentStorageID;

      let storageItem;
      try {
        // eslint-disable-next-line no-await-in-loop
        storageItem = await encryptRecord(storageID, storageRecord);
      } catch (err) {
        window.log.error(
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
          window.log.info(
            'storageService.generateManifest: new key',
            conversation.idForLogging(),
            redactStorageID(storageID)
          );
        } else {
          window.log.info(
            'storageService.generateManifest: no storage id',
            conversation.idForLogging()
          );
        }

        const oldStorageID = conversation.get('storageID');
        if (oldStorageID) {
          window.log.info(
            'storageService.generateManifest: deleting key',
            redactStorageID(oldStorageID)
          );
          deleteKeys.push(base64ToArrayBuffer(oldStorageID));
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

  window.log.info(
    'storageService.generateManifest: adding unknown records:',
    unknownRecordsArray.length
  );

  // When updating the manifest, ensure all "unknown" keys are added to the
  // new manifest, so we don't inadvertently delete something we don't understand
  unknownRecordsArray.forEach((record: UnknownRecord) => {
    const identifier = new window.textsecure.protobuf.ManifestRecord.Identifier();
    identifier.type = record.itemType;
    identifier.raw = base64ToArrayBuffer(record.storageID);

    manifestRecordKeys.add(identifier);
  });

  const recordsWithErrors: ReadonlyArray<UnknownRecord> =
    window.storage.get('storage-service-error-records') || [];

  window.log.info(
    'storageService.generateManifest: adding records that had errors in the previous merge',
    recordsWithErrors.length
  );

  // These records failed to merge in the previous fetchManifest, but we still
  // need to include them so that the manifest is complete
  recordsWithErrors.forEach((record: UnknownRecord) => {
    const identifier = new window.textsecure.protobuf.ManifestRecord.Identifier();
    identifier.type = record.itemType;
    identifier.raw = base64ToArrayBuffer(record.storageID);

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
    const storageID = arrayBufferToBase64(identifier.raw);
    const typeAndRaw = `${identifier.type}+${storageID}`;
    if (
      rawDuplicates.has(identifier.raw) ||
      typeRawDuplicates.has(typeAndRaw)
    ) {
      window.log.info(
        'storageService.generateManifest: removing duplicate identifier from manifest',
        identifier.type
      );
      manifestRecordKeys.delete(identifier);
    }
    rawDuplicates.add(identifier.raw);
    typeRawDuplicates.add(typeAndRaw);

    // Ensure all deletes are not present in the manifest
    const hasDeleteKey = deleteKeys.find(
      key => arrayBufferToBase64(key) === storageID
    );
    if (hasDeleteKey) {
      window.log.info(
        'storageService.generateManifest: removing key which has been deleted',
        identifier.type
      );
      manifestRecordKeys.delete(identifier);
    }

    // Ensure that there is *exactly* one Account type in the manifest
    if (identifier.type === ITEM_TYPE.ACCOUNT) {
      if (hasAccountType) {
        window.log.info(
          'storageService.generateManifest: removing duplicate account'
        );
        manifestRecordKeys.delete(identifier);
      }
      hasAccountType = true;
    }
  });

  rawDuplicates.clear();
  typeRawDuplicates.clear();

  const storageKeyDuplicates = new Set();

  newItems.forEach(storageItem => {
    // Ensure there are no duplicate StorageIdentifiers in your list of inserts
    const storageID = storageItem.key;
    if (storageKeyDuplicates.has(storageID)) {
      window.log.info(
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
    previousManifest.keys.forEach(
      (identifier: ManifestRecordIdentifierClass) => {
        const storageID = arrayBufferToBase64(identifier.raw.toArrayBuffer());
        remoteKeys.add(storageID);
      }
    );

    const localKeys: Set<string> = new Set();
    manifestRecordKeys.forEach((identifier: ManifestRecordIdentifierClass) => {
      const storageID = arrayBufferToBase64(identifier.raw.toArrayBuffer());
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
      throw new Error('invalid write delete keys length do not match');
    }
    if (newItems.size !== pendingInserts.size) {
      throw new Error('invalid write insert items length do not match');
    }
    deleteKeys.forEach(key => {
      const storageID = arrayBufferToBase64(key);
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

  const manifestRecord = new window.textsecure.protobuf.ManifestRecord();
  manifestRecord.version = version;
  manifestRecord.keys = Array.from(manifestRecordKeys);

  const storageKeyBase64 = window.storage.get('storageKey');
  const storageKey = base64ToArrayBuffer(storageKeyBase64);
  const storageManifestKey = await deriveStorageManifestKey(
    storageKey,
    version
  );
  const encryptedManifest = await Crypto.encryptProfile(
    manifestRecord.toArrayBuffer(),
    storageManifestKey
  );

  const storageManifest = new window.textsecure.protobuf.StorageManifest();
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
    window.log.info('storageService.uploadManifest: nothing to upload');
    return;
  }

  const credentials = window.storage.get('storageCredentials');
  try {
    window.log.info(
      'storageService.uploadManifest: keys inserting, deleting:',
      newItems.size,
      deleteKeys.length
    );

    const writeOperation = new window.textsecure.protobuf.WriteOperation();
    writeOperation.manifest = storageManifest;
    writeOperation.insertItem = Array.from(newItems);
    writeOperation.deleteKey = deleteKeys;

    window.log.info('storageService.uploadManifest: uploading...', version);
    await window.textsecure.messaging.modifyStorageRecords(
      writeOperation.toArrayBuffer(),
      {
        credentials,
      }
    );

    window.log.info(
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
    window.log.error(
      'storageService.uploadManifest: failed!',
      err && err.stack ? err.stack : String(err)
    );

    if (err.code === 409) {
      if (consecutiveConflicts > 3) {
        window.log.error(
          'storageService.uploadManifest: Exceeded maximum consecutive conflicts'
        );
        return;
      }
      consecutiveConflicts += 1;

      window.log.info(
        `storageService.uploadManifest: Conflict found with v${version}, running sync job times(${consecutiveConflicts})`
      );

      throw err;
    }

    throw err;
  }

  window.log.info(
    'storageService.uploadManifest: setting new manifestVersion',
    version
  );
  window.storage.put('manifestVersion', version);
  consecutiveConflicts = 0;
  consecutiveStops = 0;
  await window.textsecure.messaging.sendFetchManifestSyncMessage();
}

async function stopStorageServiceSync() {
  window.log.info('storageService.stopStorageServiceSync');

  await window.storage.remove('storageKey');

  if (consecutiveStops < 5) {
    await backOff(consecutiveStops);
    window.log.info(
      'storageService.stopStorageServiceSync: requesting new keys'
    );
    consecutiveStops += 1;
    setTimeout(() => {
      if (!window.textsecure.messaging) {
        throw new Error(
          'storageService.stopStorageServiceSync: We are offline!'
        );
      }
      window.textsecure.messaging.sendRequestKeySyncMessage();
    });
  }
}

async function createNewManifest() {
  window.log.info('storageService.createNewManifest: creating new manifest');

  const version = window.storage.get('manifestVersion') || 0;

  const {
    conversationsToUpdate,
    newItems,
    storageManifest,
  } = await generateManifest(version, undefined, true);

  await uploadManifest(version, {
    conversationsToUpdate,
    // we have created a new manifest, there should be no keys to delete
    deleteKeys: [],
    newItems,
    storageManifest,
  });
}

async function decryptManifest(
  encryptedManifest: StorageManifestClass
): Promise<ManifestRecordClass> {
  const { version, value } = encryptedManifest;

  const storageKeyBase64 = window.storage.get('storageKey');
  const storageKey = base64ToArrayBuffer(storageKeyBase64);
  const storageManifestKey = await deriveStorageManifestKey(
    storageKey,
    typeof version === 'number' ? version : version.toNumber()
  );

  const decryptedManifest = await Crypto.decryptProfile(
    typeof value.toArrayBuffer === 'function' ? value.toArrayBuffer() : value,
    storageManifestKey
  );

  return window.textsecure.protobuf.ManifestRecord.decode(decryptedManifest);
}

async function fetchManifest(
  manifestVersion: string
): Promise<ManifestRecordClass | undefined> {
  window.log.info('storageService.fetchManifest');

  if (!window.textsecure.messaging) {
    throw new Error('storageService.fetchManifest: We are offline!');
  }

  try {
    const credentials = await window.textsecure.messaging.getStorageCredentials();
    window.storage.put('storageCredentials', credentials);

    const manifestBinary = await window.textsecure.messaging.getStorageManifest(
      {
        credentials,
        greaterThanVersion: manifestVersion,
      }
    );
    const encryptedManifest = window.textsecure.protobuf.StorageManifest.decode(
      manifestBinary
    );

    // if we don't get a value we're assuming that there's no newer manifest
    if (!encryptedManifest.value || !encryptedManifest.version) {
      window.log.info('storageService.fetchManifest: nothing changed');
      return;
    }

    try {
      // eslint-disable-next-line consistent-return
      return decryptManifest(encryptedManifest);
    } catch (err) {
      await stopStorageServiceSync();
      return;
    }
  } catch (err) {
    window.log.error(
      'storageService.fetchManifest: failed!',
      err && err.stack ? err.stack : String(err)
    );

    if (err.code === 404) {
      await createNewManifest();
      return;
    }
    if (err.code === 204) {
      // noNewerManifest we're ok
      return;
    }

    throw err;
  }
}

type MergeableItemType = {
  itemType: number;
  storageID: string;
  storageRecord: StorageRecordClass;
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

  const ITEM_TYPE = window.textsecure.protobuf.ManifestRecord.Identifier.Type;

  let hasConflict = false;
  let isUnsupported = false;
  let hasError = false;

  try {
    if (itemType === ITEM_TYPE.UNKNOWN) {
      window.log.info(
        'storageService.mergeRecord: Unknown item type',
        storageID
      );
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
      window.log.info('storageService.mergeRecord: Unknown record:', itemType);
    }
    window.log.info(
      'storageService.mergeRecord: merged',
      redactStorageID(storageID),
      itemType,
      hasConflict
    );
  } catch (err) {
    hasError = true;
    window.log.error(
      'storageService.mergeRecord: Error with',
      redactStorageID(storageID),
      itemType
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
  manifest: ManifestRecordClass
): Promise<boolean> {
  if (!window.textsecure.messaging) {
    throw new Error('storageService.processManifest: We are offline!');
  }

  const remoteKeysTypeMap = new Map();
  manifest.keys.forEach((identifier: ManifestRecordIdentifierClass) => {
    remoteKeysTypeMap.set(
      arrayBufferToBase64(identifier.raw.toArrayBuffer()),
      identifier.type
    );
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

  window.log.info(
    'storageService.processManifest: local records:',
    conversations.length
  );
  window.log.info(
    'storageService.processManifest: local keys:',
    localKeys.size
  );
  window.log.info(
    'storageService.processManifest: unknown records:',
    stillUnknown.length
  );
  window.log.info(
    'storageService.processManifest: remote keys:',
    remoteKeys.size
  );

  const remoteOnlySet: Set<string> = new Set();
  remoteKeys.forEach((key: string) => {
    if (!localKeys.has(key)) {
      remoteOnlySet.add(key);
    }
  });

  window.log.info(
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

  const conflictCount = await processRemoteRecords(remoteOnlyRecords);

  // Post-merge, if our local records contain any storage IDs that were not
  // present in the remote manifest then we'll need to clear it, generate a
  // new storageID for that record, and upload.
  // This might happen if a device pushes a manifest which doesn't contain
  // the keys that we have in our local database.
  window.getConversations().forEach((conversation: ConversationModel) => {
    const storageID = conversation.get('storageID');
    if (storageID && !remoteKeys.has(storageID)) {
      window.log.info(
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
  const storageKey = base64ToArrayBuffer(storageKeyBase64);

  window.log.info(
    'storageService.processRemoteRecords: remote only keys',
    remoteOnlyRecords.size
  );

  const readOperation = new window.textsecure.protobuf.ReadOperation();
  readOperation.readKey = Array.from(remoteOnlyRecords.keys()).map(
    base64ToArrayBuffer
  );

  const credentials = window.storage.get('storageCredentials');
  const storageItemsBuffer = await window.textsecure.messaging.getStorageRecords(
    readOperation.toArrayBuffer(),
    {
      credentials,
    }
  );

  const storageItems = window.textsecure.protobuf.StorageItems.decode(
    storageItemsBuffer
  );

  if (!storageItems.items) {
    window.log.info(
      'storageService.processRemoteRecords: No storage items retrieved'
    );
    return 0;
  }

  const decryptedStorageItems = await pMap(
    storageItems.items,
    async (
      storageRecordWrapper: StorageItemClass
    ): Promise<MergeableItemType> => {
      const { key, value: storageItemCiphertext } = storageRecordWrapper;

      if (!key || !storageItemCiphertext) {
        window.log.error(
          'storageService.processRemoteRecords: No key or Ciphertext available'
        );
        await stopStorageServiceSync();
        throw new Error(
          'storageService.processRemoteRecords: Missing key and/or Ciphertext'
        );
      }

      const base64ItemID = arrayBufferToBase64(key.toArrayBuffer());

      const storageItemKey = await deriveStorageItemKey(
        storageKey,
        base64ItemID
      );

      let storageItemPlaintext;
      try {
        storageItemPlaintext = await Crypto.decryptProfile(
          storageItemCiphertext.toArrayBuffer(),
          storageItemKey
        );
      } catch (err) {
        window.log.error(
          'storageService.processRemoteRecords: Error decrypting storage item'
        );
        await stopStorageServiceSync();
        throw err;
      }

      const storageRecord = window.textsecure.protobuf.StorageRecord.decode(
        storageItemPlaintext
      );

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
  const ITEM_TYPE = window.textsecure.protobuf.ManifestRecord.Identifier.Type;
  const sortedStorageItems = decryptedStorageItems.sort((_, b) =>
    b.itemType === ITEM_TYPE.ACCOUNT ? -1 : 1
  );

  try {
    window.log.info(
      `storageService.processRemoteRecords: Attempting to merge ${sortedStorageItems.length} records`
    );
    const mergedRecords = await pMap(sortedStorageItems, mergeRecord, {
      concurrency: 5,
    });
    window.log.info(
      `storageService.processRemoteRecords: Processed ${mergedRecords.length} records`
    );

    // Collect full map of previously and currently unknown records
    const unknownRecords: Map<string, UnknownRecord> = new Map();

    const unknownRecordsArray: ReadonlyArray<UnknownRecord> =
      window.storage.get('storage-service-unknown-records') || [];
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

    window.log.info(
      'storageService.processRemoteRecords: Unknown records found:',
      newUnknownRecords.length
    );
    window.storage.put('storage-service-unknown-records', newUnknownRecords);

    window.log.info(
      'storageService.processRemoteRecords: Records with errors:',
      newRecordsWithErrors.length
    );
    // Refresh the list of records that had errors with every push, that way
    // this list doesn't grow unbounded and we keep the list of storage keys
    // fresh.
    window.storage.put('storage-service-error-records', newRecordsWithErrors);

    if (conflictCount !== 0) {
      window.log.info(
        'storageService.processRemoteRecords: ' +
          `${conflictCount} conflicts found, uploading changes`
      );

      return conflictCount;
    }

    consecutiveConflicts = 0;
  } catch (err) {
    window.log.error(
      'storageService.processRemoteRecords: failed!',
      err && err.stack ? err.stack : String(err)
    );
  }

  return 0;
}

async function sync(): Promise<ManifestRecordClass | undefined> {
  if (!isStorageWriteFeatureEnabled()) {
    window.log.info(
      'storageService.sync: Not starting desktop.storage is falsey'
    );

    return undefined;
  }

  if (!window.storage.get('storageKey')) {
    throw new Error('storageService.sync: Cannot start; no storage key!');
  }

  window.log.info('storageService.sync: starting...');

  let manifest: ManifestRecordClass | undefined;
  try {
    // If we've previously interacted with strage service, update 'fetchComplete' record
    const previousFetchComplete = window.storage.get('storageFetchComplete');
    const manifestFromStorage = window.storage.get('manifestVersion');
    if (!previousFetchComplete && isNumber(manifestFromStorage)) {
      window.storage.put('storageFetchComplete', true);
    }

    const localManifestVersion = manifestFromStorage || 0;
    manifest = await fetchManifest(localManifestVersion);

    // Guarding against no manifests being returned, everything should be ok
    if (!manifest) {
      window.log.info('storageService.sync: no new manifest');
      return undefined;
    }

    const version = manifest.version.toNumber();

    window.log.info(
      `storageService.sync: manifest versions - previous: ${localManifestVersion}, current: ${version}`
    );

    window.storage.put('manifestVersion', version);

    const hasConflicts = await processManifest(manifest);
    if (hasConflicts) {
      await upload(true);
    }

    // We now know that we've successfully completed a storage service fetch
    window.storage.put('storageFetchComplete', true);
  } catch (err) {
    window.log.error(
      'storageService.sync: error processing manifest',
      err && err.stack ? err.stack : String(err)
    );
  }

  window.log.info('storageService.sync: complete');
  return manifest;
}

async function upload(fromSync = false): Promise<void> {
  if (!isStorageWriteFeatureEnabled()) {
    window.log.info(
      'storageService.upload: Not starting because the feature is not enabled'
    );

    return;
  }

  if (!window.textsecure.messaging) {
    throw new Error('storageService.upload: We are offline!');
  }

  // Rate limit uploads coming from syncing
  if (fromSync) {
    uploadBucket.push(Date.now());
    if (uploadBucket.length >= 3) {
      const [firstMostRecentWrite] = uploadBucket;

      if (isMoreRecentThan(5 * MINUTE, firstMostRecentWrite)) {
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
    window.log.info(
      'storageService.upload: no storageKey, requesting new keys'
    );
    consecutiveStops = 0;
    await window.textsecure.messaging.sendRequestKeySyncMessage();
    return;
  }

  let previousManifest: ManifestRecordClass | undefined;
  if (!fromSync) {
    // Syncing before we upload so that we repair any unknown records and
    // records with errors as well as ensure that we have the latest up to date
    // manifest.
    previousManifest = await sync();
  }

  const localManifestVersion = window.storage.get('manifestVersion') || 0;
  const version = Number(localManifestVersion) + 1;

  window.log.info(
    'storageService.upload: will update to manifest version',
    version
  );

  try {
    const generatedManifest = await generateManifest(version, previousManifest);
    await uploadManifest(version, generatedManifest);
  } catch (err) {
    if (err.code === 409) {
      await backOff(consecutiveConflicts);
      window.log.info('storageService.upload: pushing sync on the queue');
      // The sync job will check for conflicts and as part of that conflict
      // check if an item needs sync and doesn't match with the remote record
      // it'll kick off another upload.
      setTimeout(runStorageServiceSyncJob);
      return;
    }
    window.log.error(
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
export async function eraseAllStorageServiceState(): Promise<void> {
  window.log.info('storageService.eraseAllStorageServiceState: starting...');
  await Promise.all([
    window.storage.remove('manifestVersion'),
    window.storage.remove('storage-service-unknown-records'),
    window.storage.remove('storageCredentials'),
  ]);
  await eraseStorageServiceStateFromConversations();
  window.log.info('storageService.eraseAllStorageServiceState: complete');
}

export const storageServiceUploadJob = debounce(() => {
  if (!storageServiceEnabled) {
    window.log.info(
      'storageService.storageServiceUploadJob: called before enabled'
    );
    return;
  }

  storageJobQueue(async () => {
    await upload();
  }, `upload v${window.storage.get('manifestVersion')}`);
}, 500);

export const runStorageServiceSyncJob = debounce(() => {
  if (!storageServiceEnabled) {
    window.log.info(
      'storageService.runStorageServiceSyncJob: called before enabled'
    );
    return;
  }

  storageJobQueue(async () => {
    await sync();
  }, `sync v${window.storage.get('manifestVersion')}`);
}, 500);
