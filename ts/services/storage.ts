import _ from 'lodash';
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
import { ConversationModelType } from '../model-types.d';
import { isEnabled } from '../RemoteConfig';
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

const {
  eraseStorageServiceStateFromConversations,
  updateConversation,
} = dataInterface;

let consecutiveStops = 0;
let consecutiveConflicts = 0;

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
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

type UnknownRecord = {
  itemType: number;
  storageID: string;
};

function createWriteOperation(
  storageManifest: StorageManifestClass,
  newItems: Array<StorageItemClass>,
  deleteKeys: Array<ArrayBuffer>,
  clearAll = false
) {
  const writeOperation = new window.textsecure.protobuf.WriteOperation();
  writeOperation.manifest = storageManifest;
  writeOperation.insertItem = newItems;
  writeOperation.deleteKey = deleteKeys;
  writeOperation.clearAll = clearAll;

  return writeOperation;
}

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
    conversation: ConversationModelType;
    storageID: string | undefined;
  }>;
  deleteKeys: Array<ArrayBuffer>;
  newItems: Set<StorageItemClass>;
  storageManifest: StorageManifestClass;
};

/* tslint:disable-next-line max-func-body-length */
async function generateManifest(
  version: number,
  isNewManifest = false
): Promise<GeneratedManifestType> {
  window.log.info(
    `storageService.generateManifest: generating manifest for version ${version}. Is new? ${isNewManifest}`
  );

  const ITEM_TYPE = window.textsecure.protobuf.ManifestRecord.Identifier.Type;

  const conversationsToUpdate = [];
  const deleteKeys = [];
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
    } else if ((conversation.get('groupVersion') || 0) > 1) {
      storageRecord = new window.textsecure.protobuf.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.groupV2 = await toGroupV2Record(conversation);
      identifier.type = ITEM_TYPE.GROUPV2;
    } else {
      storageRecord = new window.textsecure.protobuf.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.groupV1 = await toGroupV1Record(conversation);
      identifier.type = ITEM_TYPE.GROUPV1;
    }

    if (storageRecord) {
      const isNewItem =
        isNewManifest || Boolean(conversation.get('needsStorageServiceSync'));

      const storageID = isNewItem
        ? arrayBufferToBase64(generateStorageID())
        : conversation.get('storageID');

      // eslint-disable-next-line no-await-in-loop
      const storageItem = await encryptRecord(storageID, storageRecord);
      identifier.raw = storageItem.key;

      // When a client needs to update a given record it should create it
      // under a new key and delete the existing key.
      if (isNewItem) {
        newItems.add(storageItem);

        const oldStorageID = conversation.get('storageID');
        if (oldStorageID) {
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

  const unknownRecordsArray =
    window.storage.get('storage-service-unknown-records') || [];

  window.log.info(
    `storageService.generateManifest: adding ${unknownRecordsArray.length} unknown records`
  );

  // When updating the manifest, ensure all "unknown" keys are added to the
  // new manifest, so we don't inadvertently delete something we don't understand
  unknownRecordsArray.forEach((record: UnknownRecord) => {
    const identifier = new window.textsecure.protobuf.ManifestRecord.Identifier();
    identifier.type = record.itemType;
    identifier.raw = base64ToArrayBuffer(record.storageID);

    manifestRecordKeys.add(identifier);
  });

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

  const credentials = window.storage.get('storageCredentials');
  try {
    window.log.info(
      `storageService.uploadManifest: inserting ${newItems.size} items, deleting ${deleteKeys.length} keys`
    );

    const writeOperation = createWriteOperation(
      storageManifest,
      Array.from(newItems),
      deleteKeys
    );

    window.log.info('storageService.uploadManifest: uploading...');
    await window.textsecure.messaging.modifyStorageRecords(
      writeOperation.toArrayBuffer(),
      {
        credentials,
      }
    );

    window.log.info(
      `storageService.uploadManifest: upload done, updating ${conversationsToUpdate.length} conversation(s) with new storageIDs`
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
      `storageService.uploadManifest: failed! ${
        err && err.stack ? err.stack : String(err)
      }`
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
        `storageService.uploadManifest: Conflict found, running sync job times(${consecutiveConflicts})`
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
  } = await generateManifest(version, true);

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
      `storageService.fetchManifest: failed! ${
        err && err.stack ? err.stack : String(err)
      }`
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
  isUnsupported: boolean;
};

async function mergeRecord(
  itemToMerge: MergeableItemType
): Promise<MergedRecordType> {
  const { itemType, storageID, storageRecord } = itemToMerge;

  const ITEM_TYPE = window.textsecure.protobuf.ManifestRecord.Identifier.Type;

  let hasConflict = false;
  let isUnsupported = false;

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
    } else if (
      window.GV2 &&
      itemType === ITEM_TYPE.GROUPV2 &&
      storageRecord.groupV2
    ) {
      hasConflict = await mergeGroupV2Record(storageID, storageRecord.groupV2);
    } else if (itemType === ITEM_TYPE.ACCOUNT && storageRecord.account) {
      hasConflict = await mergeAccountRecord(storageID, storageRecord.account);
    } else {
      isUnsupported = true;
      window.log.info(
        `storageService.mergeRecord: Unknown record: ${itemType}::${storageID}`
      );
    }
  } catch (err) {
    window.log.error(
      `storageService.mergeRecord: merging record failed ${storageID}`
    );
  }

  return {
    hasConflict,
    isUnsupported,
    itemType,
    storageID,
  };
}

/* tslint:disable-next-line max-func-body-length */
async function processManifest(
  manifest: ManifestRecordClass
): Promise<boolean> {
  const storageKeyBase64 = window.storage.get('storageKey');
  const storageKey = base64ToArrayBuffer(storageKeyBase64);

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

  const localKeys = window
    .getConversations()
    .map((conversation: ConversationModelType) => conversation.get('storageID'))
    .filter(Boolean);

  const unknownRecordsArray =
    window.storage.get('storage-service-unknown-records') || [];

  unknownRecordsArray.forEach((record: UnknownRecord) => {
    localKeys.push(record.storageID);
  });

  window.log.info(
    `storageService.processManifest: localKeys.length ${localKeys.length}`
  );

  const remoteKeys = Array.from(remoteKeysTypeMap.keys());

  const remoteOnly = remoteKeys.filter(
    (key: string) => !localKeys.includes(key)
  );

  window.log.info(
    `storageService.processManifest: remoteOnly.length ${remoteOnly.length}`
  );

  const readOperation = new window.textsecure.protobuf.ReadOperation();
  readOperation.readKey = remoteOnly.map(base64ToArrayBuffer);

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
      'storageService.processManifest: No storage items retrieved'
    );
    return false;
  }

  const decryptedStorageItems = await pMap(
    storageItems.items,
    async (storageRecordWrapper: StorageItemClass) => {
      const { key, value: storageItemCiphertext } = storageRecordWrapper;

      if (!key || !storageItemCiphertext) {
        window.log.error(
          'storageService.processManifest: No key or Ciphertext available'
        );
        await stopStorageServiceSync();
        throw new Error(
          'storageService.processManifest: Missing key and/or Ciphertext'
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
          'storageService.processManifest: Error decrypting storage item'
        );
        await stopStorageServiceSync();
        throw err;
      }

      const storageRecord = window.textsecure.protobuf.StorageRecord.decode(
        storageItemPlaintext
      );

      return {
        itemType: remoteKeysTypeMap.get(base64ItemID),
        storageID: base64ItemID,
        storageRecord,
      };
    },
    { concurrency: 50 }
  );

  try {
    const mergedRecords = await pMap(decryptedStorageItems, mergeRecord, {
      concurrency: 5,
    });

    const unknownRecords: Map<string, UnknownRecord> = new Map();
    unknownRecordsArray.forEach((record: UnknownRecord) => {
      unknownRecords.set(record.storageID, record);
    });

    const hasConflict = mergedRecords.some((mergedRecord: MergedRecordType) => {
      if (mergedRecord.isUnsupported) {
        unknownRecords.set(mergedRecord.storageID, {
          itemType: mergedRecord.itemType,
          storageID: mergedRecord.storageID,
        });
      }
      return mergedRecord.hasConflict;
    });

    window.storage.put(
      'storage-service-unknown-records',
      Array.from(unknownRecords.values())
    );

    if (hasConflict) {
      window.log.info(
        'storageService.processManifest: Conflict found, uploading changes'
      );

      return true;
    }

    consecutiveConflicts = 0;
  } catch (err) {
    window.log.error(
      `storageService.processManifest: failed! ${
        err && err.stack ? err.stack : String(err)
      }`
    );
  }

  return false;
}

// Exported functions

export async function runStorageServiceSyncJob(): Promise<void> {
  if (!isEnabled('desktop.storage')) {
    window.log.info(
      'storageService.runStorageServiceSyncJob: Not starting desktop.storage is falsey'
    );

    return;
  }

  if (!window.storage.get('storageKey')) {
    throw new Error(
      'storageService.runStorageServiceSyncJob: Cannot start; no storage key!'
    );
  }

  window.log.info('storageService.runStorageServiceSyncJob: starting...');

  try {
    const localManifestVersion = window.storage.get('manifestVersion') || 0;
    const manifest = await fetchManifest(localManifestVersion);

    // Guarding against no manifests being returned, everything should be ok
    if (!manifest) {
      window.log.info(
        'storageService.runStorageServiceSyncJob: no manifest, returning early'
      );
      return;
    }

    const version = manifest.version.toNumber();

    window.log.info(
      `storageService.runStorageServiceSyncJob: manifest versions - previous: ${localManifestVersion}, current: ${version}`
    );

    const hasConflicts = await processManifest(manifest);
    if (hasConflicts) {
      await storageServiceUploadJob();
    }

    window.storage.put('manifestVersion', version);
  } catch (err) {
    window.log.error(
      `storageService.runStorageServiceSyncJob: error processing manifest ${
        err && err.stack ? err.stack : String(err)
      }`
    );
  }

  window.log.info('storageService.runStorageServiceSyncJob: complete');
}

// Note: this function must be called at startup once we handle unknown records
// of a certain type. This way once the runStorageServiceSyncJob function runs
// it'll pick up the new storage IDs and process them accordingly.
export function handleUnknownRecords(itemType: number): void {
  const unknownRecordsArray =
    window.storage.get('storage-service-unknown-records') || [];
  const newUnknownRecords = unknownRecordsArray.filter(
    (record: UnknownRecord) => record.itemType !== itemType
  );
  window.storage.put('storage-service-unknown-records', newUnknownRecords);
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

async function nondebouncedStorageServiceUploadJob(): Promise<void> {
  if (!isEnabled('desktop.storage')) {
    window.log.info(
      'storageService.storageServiceUploadJob: Not starting desktop.storage is falsey'
    );

    return;
  }
  if (!isEnabled('desktop.storageWrite')) {
    window.log.info(
      'storageService.storageServiceUploadJob: Not starting desktop.storageWrite is falsey'
    );

    return;
  }

  if (!window.textsecure.messaging) {
    throw new Error('storageService.storageServiceUploadJob: We are offline!');
  }

  if (!window.storage.get('storageKey')) {
    // requesting new keys runs the sync job which will detect the conflict
    // and re-run the upload job once we're merged and up-to-date.
    window.log.info(
      'storageService.storageServiceUploadJob: no storageKey, requesting new keys'
    );
    consecutiveStops = 0;
    await window.textsecure.messaging.sendRequestKeySyncMessage();
    return;
  }

  const localManifestVersion = window.storage.get('manifestVersion') || 0;
  const version = Number(localManifestVersion) + 1;

  window.log.info(
    'storageService.storageServiceUploadJob: will update to manifest version',
    version
  );

  try {
    await uploadManifest(version, await generateManifest(version));
  } catch (err) {
    if (err.code === 409) {
      await backOff(consecutiveConflicts);
      await runStorageServiceSyncJob();
    }
  }
}

export const storageServiceUploadJob = _.debounce(
  nondebouncedStorageServiceUploadJob,
  500
);
