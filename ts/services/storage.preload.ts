// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import pMap from 'p-map';
import Long from 'long';

import { DataReader, DataWriter } from '../sql/Client.preload.js';
import * as Bytes from '../Bytes.std.js';
import {
  getRandomBytes,
  deriveStorageItemKey,
  deriveStorageManifestKey,
  encryptProfile,
  decryptProfile,
  deriveMasterKeyFromGroupV1,
  deriveStorageServiceKey,
} from '../Crypto.node.js';
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
  toNotificationProfileRecord,
  toStoryDistributionListRecord,
  toStickerPackRecord,
  toCallLinkRecord,
  mergeCallLinkRecord,
  toDefunctOrPendingCallLinkRecord,
  toChatFolderRecord,
  mergeChatFolderRecord,
  mergeNotificationProfileRecord,
} from './storageRecordOps.preload.js';
import type { MergeResultType } from './storageRecordOps.preload.js';
import { MAX_READ_KEYS } from './storageConstants.std.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { drop } from '../util/drop.std.js';
import { dropNull } from '../util/dropNull.std.js';
import * as durations from '../util/durations/index.std.js';
import { BackOff } from '../util/BackOff.std.js';
import { storageJobQueue } from '../util/JobQueue.std.js';
import { sleep } from '../util/sleep.std.js';
import { isMoreRecentThan, isOlderThan } from '../util/timestamp.std.js';
import { map, filter } from '../util/iterables.std.js';
import { getMessageQueueTime } from '../util/getMessageQueueTime.dom.js';
import { ourProfileKeyService } from './ourProfileKey.std.js';
import {
  ConversationTypes,
  isDirectConversation,
  typeofConversation,
} from '../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { createLogger } from '../logging/log.std.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.js';
import * as Errors from '../types/errors.std.js';
import type {
  ExtendedStorageID,
  RemoteRecord,
  UnknownRecord,
} from '../types/StorageService.d.ts';
import {
  modifyStorageRecords,
  getStorageCredentials,
  getStorageManifest,
  getStorageRecords,
} from '../textsecure/WebAPI.preload.js';
import { MessageSender } from '../textsecure/SendMessage.preload.js';
import type {
  StoryDistributionWithMembersType,
  StorageServiceFieldsType,
  StickerPackType,
  UninstalledStickerPackType,
} from '../sql/Interface.std.js';
import { MY_STORY_ID } from '../types/Stories.std.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { isSignalConversation } from '../util/isSignalConversation.dom.js';
import {
  redactExtendedStorageID,
  redactStorageID,
} from '../util/privacy.node.js';
import type {
  CallLinkRecord,
  DefunctCallLinkType,
  PendingCallLinkType,
} from '../types/CallLink.std.js';
import {
  callLinkFromRecord,
  getRoomIdFromRootKeyString,
} from '../util/callLinksRingrtc.node.js';
import { fromPniUuidBytesOrUntaggedString } from '../util/ServiceId.node.js';
import { isDone as isRegistrationDone } from '../util/registration.preload.js';
import { callLinkRefreshJobQueue } from '../jobs/callLinkRefreshJobQueue.preload.js';
import { isMockEnvironment } from '../environment.std.js';
import { validateConversation } from '../util/validateConversation.dom.js';
import type { ChatFolder } from '../types/ChatFolder.std.js';
import { isCurrentAllChatFolder } from '../types/CurrentChatFolders.std.js';
import type { NotificationProfileType } from '../types/NotificationProfile.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { debounce, isNumber, chunk } = lodash;

const log = createLogger('storage');

type IManifestRecordIdentifier = Proto.ManifestRecord.IIdentifier;

const { getItemById } = DataReader;

const {
  eraseStorageServiceState,
  flushUpdateConversationBatcher,
  updateConversation,
  updateConversations,
} = DataWriter;

const uploadBucket: Array<number> = [];

const ITEM_TYPE = Proto.ManifestRecord.Identifier.Type;

// Note: when updating this, update the switch downfile in mergeRecord()
const validRecordTypes = new Set([
  ITEM_TYPE.UNKNOWN,
  ITEM_TYPE.CONTACT,
  ITEM_TYPE.GROUPV1,
  ITEM_TYPE.GROUPV2,
  ITEM_TYPE.ACCOUNT,
  ITEM_TYPE.STORY_DISTRIBUTION_LIST,
  ITEM_TYPE.STICKER_PACK,
  ITEM_TYPE.CALL_LINK,
  ITEM_TYPE.CHAT_FOLDER,
  ITEM_TYPE.NOTIFICATION_PROFILE,
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

  const storageKeyBase64 = itemStorage.get('storageKey');
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
  log.info(`upload(${version}): generating manifest new=${isNewManifest}`);

  await window.ConversationController.checkForConflicts();

  // Load at the beginning, so we use this one value through the whole process
  const notificationProfileSyncDisabled = itemStorage.get(
    'notificationProfileSyncDisabled',
    false
  );

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
    currentStorageID?: string | null;
    currentStorageVersion?: number | null;
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
          `upload(${version}): ` +
            `updating from=${currentRedactedID} ` +
            `to=${newRedactedID}`
        );
        deleteKeys.add(currentStorageID);
      } else {
        log.info(`upload(${version}): adding key=${newRedactedID}`);
      }
    }

    return {
      isNewItem,
      storageID,
    };
  }

  const conversations = window.ConversationController.getAll();
  for (let i = 0; i < conversations.length; i += 1) {
    const conversation = conversations[i];

    let identifierType;
    let storageRecord;

    if (isSignalConversation(conversation.attributes)) {
      continue;
    }

    const conversationType = typeofConversation(conversation.attributes);
    if (conversationType === ConversationTypes.Me) {
      storageRecord = new Proto.StorageRecord();
      // eslint-disable-next-line no-await-in-loop
      storageRecord.account = await toAccountRecord(conversation, {
        notificationProfileSyncDisabled,
      });
      identifierType = ITEM_TYPE.ACCOUNT;
    } else if (conversationType === ConversationTypes.Direct) {
      // Contacts must have UUID
      if (!conversation.getServiceId()) {
        continue;
      }

      let shouldDrop = false;
      let dropReason: string | undefined;

      const validationErrorString = validateConversation(
        conversation.attributes
      );
      if (validationErrorString) {
        shouldDrop = true;
        dropReason = `local validation error=${validationErrorString}`;
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
          `generateManifest(${version}): ` +
            `dropping contact=${recordID} ` +
            `due to ${dropReason}`
        );
        conversation.set({ storageID: undefined });
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
        `upload(${version}): ` +
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
    notificationProfiles,
    pendingCallLinks,
    storyDistributionLists,
    installedStickerPacks,
    uninstalledStickerPacks,
    chatFolders,
  } = await getNonConversationRecords();

  log.info(
    `upload(${version}): ` +
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
        `generateManifest(${version}): ` +
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

  const notificationProfilesToUpload = notificationProfileSyncDisabled
    ? notificationProfiles.filter(item => item.storageID)
    : notificationProfiles;
  if (notificationProfileSyncDisabled) {
    const localOnlyCount =
      notificationProfilesToUpload.length - notificationProfiles.length;
    log.info(
      `upload(${version}): ` +
        `sync=OFF; adding notificationProfiles=${notificationProfilesToUpload.length}, excluding ${localOnlyCount} local profiles`
    );
  } else {
    log.info(
      `upload(${version}): ` +
        `sync=ON, adding notificationProfiles=${notificationProfilesToUpload.length}`
    );
  }
  for (const notificationProfile of notificationProfilesToUpload) {
    const storageRecord = new Proto.StorageRecord();
    storageRecord.notificationProfile =
      toNotificationProfileRecord(notificationProfile);

    if (
      notificationProfile.deletedAtTimestampMs != null &&
      notificationProfile.deletedAtTimestampMs !== 0 &&
      isOlderThan(
        notificationProfile.deletedAtTimestampMs,
        getMessageQueueTime()
      )
    ) {
      const droppedID = notificationProfile.storageID;
      const droppedVersion = notificationProfile.storageVersion;
      if (!droppedID) {
        continue;
      }

      const recordID = redactStorageID(droppedID, droppedVersion);

      log.info(
        `generateManifest(${version}): ` +
          `dropping notificationProfile=${recordID} ` +
          `due to expired deleted timestamp=${notificationProfile.deletedAtTimestampMs}`
      );
      deleteKeys.add(droppedID);

      const { id } = notificationProfile;
      drop(DataWriter.deleteNotificationProfileById(id));
      window.reduxActions.notificationProfiles.profileWasRemoved(id);
      continue;
    }

    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: notificationProfile.storageID,
      currentStorageVersion: notificationProfile.storageVersion,
      identifierType: ITEM_TYPE.NOTIFICATION_PROFILE,
      storageNeedsSync: notificationProfile.storageNeedsSync,
      storageRecord,
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        const updated = {
          ...notificationProfile,
          storageID,
          storageVersion: version,
          storageNeedsSync: false,
        };
        drop(DataWriter.updateNotificationProfile(updated));
        window.reduxActions.notificationProfiles.profileWasUpdated(updated);
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
        `upload(${version}): ` +
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
    `upload(${version}): stickerPacks ` +
      `installed=${newlyInstalledPacks}/${installedStickerPacks.length} ` +
      `uninstalled=${newlyUninstalledPacks}/${uninstalledStickerPacks.length}`
  );

  log.info(`upload(${version}): adding callLinks=${callLinkDbRecords.length}`);

  const callLinkRoomIds = new Set<string>();

  for (const callLinkDbRecord of callLinkDbRecords) {
    const { roomId } = callLinkDbRecord;
    if (callLinkDbRecord.adminKey == null || callLinkDbRecord.rootKey == null) {
      log.warn(`upload(${version}): call link ${roomId} has empty rootKey`);
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
            `upload(${version}): ` +
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
    `upload(${version}): ` +
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
    `upload(${version}): ` +
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

  log.info(`upload(${version}): adding chatFolders=${chatFolders.length}`);

  chatFolders.forEach(chatFolder => {
    const { isNewItem, storageID } = processStorageRecord({
      currentStorageID: chatFolder.storageID ?? undefined,
      currentStorageVersion: chatFolder.storageVersion ?? undefined,
      identifierType: ITEM_TYPE.CHAT_FOLDER,
      storageNeedsSync: chatFolder.storageNeedsSync,
      storageRecord: new Proto.StorageRecord({
        chatFolder: toChatFolderRecord(chatFolder),
      }),
    });

    if (isNewItem) {
      postUploadUpdateFunctions.push(() => {
        drop(
          DataWriter.updateChatFolder({
            ...chatFolder,
            storageID,
            storageVersion: version,
            storageNeedsSync: false,
          })
        );
      });
    }
  });

  const unknownRecordsArray: ReadonlyArray<UnknownRecord> = (
    itemStorage.get('storage-service-unknown-records') || []
  ).filter((record: UnknownRecord) => !validRecordTypes.has(record.itemType));

  const redactedUnknowns = unknownRecordsArray.map(redactExtendedStorageID);

  log.info(
    `upload(${version}): adding unknown ` +
      `records=${JSON.stringify(redactedUnknowns)} ` +
      `count=${redactedUnknowns.length}`
  );

  // When updating the manifest, ensure all "unknown" keys are added to the
  // new manifest, so we don't inadvertently delete something we don't understand
  unknownRecordsArray.forEach((record: UnknownRecord) => {
    recordsByID.set(record.storageID, record);
  });

  const recordsWithErrors: ReadonlyArray<UnknownRecord> = itemStorage.get(
    'storage-service-error-records',
    new Array<UnknownRecord>()
  );
  const redactedErrors = recordsWithErrors.map(redactExtendedStorageID);

  log.info(
    `upload(${version}): adding error ` +
      `records=${JSON.stringify(redactedErrors)} count=${redactedErrors.length}`
  );

  // These records failed to merge in the previous fetchManifest, but we still
  // need to include them so that the manifest is complete
  recordsWithErrors.forEach((record: UnknownRecord) => {
    recordsByID.set(record.storageID, record);
  });

  // Delete keys that we wanted to drop during the processing of the manifest.
  const storedPendingDeletes = itemStorage.get(
    'storage-service-pending-deletes',
    []
  );
  const redactedPendingDeletes = storedPendingDeletes.map(
    redactExtendedStorageID
  );
  log.info(
    `upload(${version}): ` +
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
        `upload(${version}): removing from duplicate item ` +
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
        `upload(${version}): removing key which has been deleted`,
        redactStorageID(storageID),
        itemType
      );
      recordsByID.delete(storageID);
    }

    // Ensure that there is *exactly* one Account type in the manifest
    if (itemType === ITEM_TYPE.ACCOUNT) {
      if (hasAccountType) {
        log.warn(
          `upload(${version}): removing duplicate account`,
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
        `upload(${version}): removing duplicate identifier from inserts`,
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
    (previousManifest.identifiers ?? []).forEach(
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
    await itemStorage.put(
      'storage-service-pending-deletes',
      // Note: `deleteKeys` already includes the prev value of
      // 'storage-service-pending-deletes'
      Array.from(deleteKeys, storageID => ({
        storageID,
        storageVersion: version,
      }))
    );

    if (deleteKeys.size !== pendingDeletes.size) {
      const localDeletes = Array.from(deleteKeys, key => {
        return redactStorageID(key);
      });
      const remoteDeletes = Array.from(pendingDeletes, id => {
        return redactStorageID(id);
      });
      log.error(
        `upload(${version}): delete key sizes do not match`,
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
    recordIkm = itemStorage.get('manifestRecordIkm');
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
          `upload(${version}): encrypt record failed:`,
          Errors.toLogFormat(err)
        );
        throw err;
      }

      newItems.add(storageItem);
    }
  }

  const manifestRecord = new Proto.ManifestRecord();
  manifestRecord.version = Long.fromNumber(version);
  manifestRecord.sourceDevice = itemStorage.user.getDeviceId() ?? 0;
  manifestRecord.identifiers = Array.from(manifestRecordKeys);
  if (recordIkm != null) {
    manifestRecord.recordIkm = recordIkm;
  }

  const storageKeyBase64 = itemStorage.get('storageKey');
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
  if (newItems.size === 0 && deleteKeys.size === 0) {
    log.info(`upload(${version}): nothing to upload`);
    return;
  }

  const credentials = itemStorage.get('storageCredentials');
  try {
    log.info(
      `upload(${version}): inserting=${newItems.size} ` +
        `deleting=${deleteKeys.size}`
    );

    const writeOperation = new Proto.WriteOperation();
    writeOperation.manifest = storageManifest;
    writeOperation.insertItem = Array.from(newItems);
    writeOperation.deleteKey = Array.from(deleteKeys).map(storageID =>
      Bytes.fromBase64(storageID)
    );

    await modifyStorageRecords(
      Proto.WriteOperation.encode(writeOperation).finish(),
      {
        credentials,
      }
    );

    log.info(
      `upload(${version}): upload complete, updating ` +
        `items=${postUploadUpdateFunctions.length}`
    );

    // update conversations with the new storageID
    postUploadUpdateFunctions.forEach(fn => fn());
  } catch (err) {
    if (err.code === 409) {
      if (conflictBackOff.isFull()) {
        log.error(`upload(${version}): exceeded maximum consecutive conflicts`);
        return;
      }

      log.info(
        `upload(${version}): conflict found with ` +
          `version=${version}, running sync job ` +
          `times=${conflictBackOff.getIndex()}`
      );

      throw err;
    }

    log.error(`upload(${version}): failed!`, Errors.toLogFormat(err));
    throw err;
  }

  log.info(`upload(${version}): setting new manifestVersion`);
  await itemStorage.put('manifestVersion', version);
  conflictBackOff.reset();
  backOff.reset();

  await singleProtoJobQueue.add(MessageSender.getFetchManifestSyncMessage());
}

async function stopStorageServiceSync(reason: Error) {
  log.warn('stopStorageServiceSync', Errors.toLogFormat(reason));

  await itemStorage.remove('storageKey');

  if (backOff.isFull()) {
    log.warn('stopStorageServiceSync: too many consecutive stops');
    return;
  }

  await sleep(backOff.getAndIncrement());
  log.info('stopStorageServiceSync: requesting new keys');
  setTimeout(async () => {
    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'stopStorageServiceSync: We are primary device; not sending key sync request'
      );
      return;
    }
    await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
  });
}

async function createNewManifest() {
  log.info('createNewManifest: creating new manifest');

  const version = itemStorage.get('manifestVersion', 0);

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

  const storageKeyBase64 = itemStorage.get('storageKey');
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
  const logId = `sync(${manifestVersion})`;
  log.info(`${logId}: fetch start`);

  try {
    const credentials = await getStorageCredentials();
    await itemStorage.put('storageCredentials', credentials);

    const manifestBinary = await getStorageManifest({
      credentials,
      greaterThanVersion: manifestVersion,
    });
    const encryptedManifest = Proto.StorageManifest.decode(manifestBinary);

    try {
      return await decryptManifest(encryptedManifest);
    } catch (err) {
      await stopStorageServiceSync(err);
    }
  } catch (err) {
    if (err.code === 204) {
      log.info(`${logId}: no newer manifest, ok`);
      return undefined;
    }

    if (err.code === 404) {
      log.info(`${logId}: missing`);
      await createNewManifest();
      return undefined;
    }

    log.error(`${logId}: failed!`, err.code);
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

  let mergeResult: MergeResultType = { details: [] };
  let isUnsupported = false;
  let hasError = false;
  let updatedConversations = new Array<ConversationModel>();
  const needProfileFetch = new Array<ConversationModel>();

  try {
    // Note: when updating this switch, update the validRecordTypes set upfile
    if (itemType === ITEM_TYPE.UNKNOWN) {
      log.warn('mergeRecord: Unknown item type', redactedStorageID);
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
    } else if (itemType === ITEM_TYPE.CHAT_FOLDER && storageRecord.chatFolder) {
      mergeResult = await mergeChatFolderRecord(
        storageID,
        storageVersion,
        storageRecord.chatFolder
      );
    } else if (
      itemType === ITEM_TYPE.NOTIFICATION_PROFILE &&
      storageRecord.notificationProfile
    ) {
      mergeResult = await mergeNotificationProfileRecord(
        storageID,
        storageVersion,
        storageRecord.notificationProfile
      );
    } else {
      isUnsupported = true;
      log.warn(`merge(${redactedStorageID}): unknown item type=${itemType}`);
    }
    // Note: when updating this switch, update the validRecordTypes set upfile

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
      `merge(${redactedID}): merged item type=${itemType} ` +
        `oldID=${oldID} ` +
        `shouldDrop=${Boolean(mergeResult.shouldDrop)} ` +
        `details=${JSON.stringify(mergeResult.details)}`
    );
  } catch (err) {
    hasError = true;
    const redactedID = redactStorageID(storageID, storageVersion);
    log.error(
      `merge(${redactedID}): error with ` +
        `item type=${itemType} ` +
        `details=${Errors.toLogFormat(err)}`
    );
  }

  return {
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
  notificationProfiles: ReadonlyArray<NotificationProfileType>;
  pendingCallLinks: ReadonlyArray<PendingCallLinkType>;
  installedStickerPacks: ReadonlyArray<StickerPackType>;
  uninstalledStickerPacks: ReadonlyArray<UninstalledStickerPackType>;
  storyDistributionLists: ReadonlyArray<StoryDistributionWithMembersType>;
  chatFolders: ReadonlyArray<ChatFolder>;
}>;

// TODO: DESKTOP-3929
async function getNonConversationRecords(): Promise<NonConversationRecordsResultType> {
  const [
    callLinkDbRecords,
    defunctCallLinks,
    notificationProfiles,
    pendingCallLinks,
    storyDistributionLists,
    uninstalledStickerPacks,
    installedStickerPacks,
    chatFolders,
  ] = await Promise.all([
    DataReader.getAllCallLinkRecordsWithAdminKey(),
    DataReader.getAllDefunctCallLinksWithAdminKey(),
    DataReader.getAllNotificationProfiles(),
    callLinkRefreshJobQueue.getPendingAdminCallLinks(),
    DataReader.getAllStoryDistributionsWithMembers(),
    DataReader.getUninstalledStickerPacks(),
    DataReader.getInstalledStickerPacks(),
    DataReader.getAllChatFolders(),
  ]);

  return {
    callLinkDbRecords,
    defunctCallLinks,
    notificationProfiles,
    pendingCallLinks,
    storyDistributionLists,
    uninstalledStickerPacks,
    installedStickerPacks,
    chatFolders,
  };
}

async function processManifest(
  manifest: Proto.IManifestRecord,
  version: number
): Promise<void> {
  const remoteKeysTypeMap = new Map();
  (manifest.identifiers || []).forEach(
    ({ raw, type }: IManifestRecordIdentifier) => {
      strictAssert(raw, 'Identifier without raw field');
      remoteKeysTypeMap.set(Bytes.toBase64(raw), type);
    }
  );

  const remoteKeys = new Set(remoteKeysTypeMap.keys());
  const localVersions = new Map<string, number | null | undefined>();
  let localRecordCount = 0;

  const conversations = window.ConversationController.getAll();
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
      notificationProfiles,
      pendingCallLinks,
      storyDistributionLists,
      installedStickerPacks,
      uninstalledStickerPacks,
      chatFolders,
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

    notificationProfiles.forEach(collectLocalKeysFromFields);
    localRecordCount += notificationProfiles.length;

    pendingCallLinks.forEach(collectLocalKeysFromFields);
    localRecordCount += pendingCallLinks.length;

    storyDistributionLists.forEach(collectLocalKeysFromFields);
    localRecordCount += storyDistributionLists.length;

    uninstalledStickerPacks.forEach(collectLocalKeysFromFields);
    localRecordCount += uninstalledStickerPacks.length;

    installedStickerPacks.forEach(collectLocalKeysFromFields);
    localRecordCount += installedStickerPacks.length;

    chatFolders.forEach(collectLocalKeysFromFields);
    localRecordCount += chatFolders.length;
  }

  const unknownRecordsArray: ReadonlyArray<UnknownRecord> =
    itemStorage.get('storage-service-unknown-records') || [];

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
    `process(${version}): localRecords=${localRecordCount} ` +
      `localKeys=${localVersions.size} unknownKeys=${stillUnknown.length} ` +
      `remoteKeys=${remoteKeys.size}`
  );
  log.info(
    `process(${version}): ` +
      `remoteOnlyCount=${remoteOnlySet.size} ` +
      `remoteOnlyKeys=${JSON.stringify(redactedRemoteOnly)}`
  );
  log.info(
    `process(${version}): ` +
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

  if (remoteOnlyRecords.size) {
    const fetchResult = await fetchRemoteRecords(
      version,
      Bytes.isNotEmpty(manifest.recordIkm) ? manifest.recordIkm : undefined,
      remoteOnlyRecords
    );
    await processRemoteRecords(version, fetchResult);
  }

  // Post-merge, if our local records contain any storage IDs that were not
  // present in the remote manifest then we'll need to clear it, generate a
  // new storageID for that record, and upload.
  // This might happen if a device pushes a manifest which doesn't contain
  // the keys that we have in our local database.
  window.ConversationController.getAll().forEach(
    (conversation: ConversationModel) => {
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
            `process(${version}): localKey=${missingKey} is ` +
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
            `process(${version}): localKey=${missingKey} ` +
              'was not in remote manifest'
          );
        }
        conversation.set({ storageID: undefined, storageVersion: undefined });
        drop(updateConversation(conversation.attributes));
      }
    }
  );

  // Refetch various records post-merge
  {
    const {
      callLinkDbRecords,
      defunctCallLinks,
      pendingCallLinks,
      storyDistributionLists,
      installedStickerPacks,
      uninstalledStickerPacks,
      chatFolders,
    } = await getNonConversationRecords();

    uninstalledStickerPacks.forEach(stickerPack => {
      const { storageID, storageVersion } = stickerPack;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `process(${version}): localKey=${missingKey} was not ` +
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
        `process(${version}): localKey=${missingKey} was not ` +
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
        `process(${version}): localKey=${missingKey} was not ` +
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
      log.info(`process(${version}): creating my stories`);
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
        `process(${version}): localKey=${missingKey} was not ` +
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
        `process(${version}): localKey=${missingKey} was not ` +
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
        `process(${version}): localKey=${missingKey} was not ` +
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

    chatFolders.forEach(chatFolder => {
      const { storageID, storageVersion } = chatFolder;
      if (!storageID || remoteKeys.has(storageID)) {
        return;
      }

      const missingKey = redactStorageID(storageID, storageVersion);
      log.info(
        `process(${version}): localKey=${missingKey} was not ` +
          'in remote manifest'
      );

      void DataWriter.updateChatFolder({
        ...chatFolder,
        storageID: null,
        storageVersion: null,
      });

      window.reduxActions.chatFolders.refetchChatFolders();
    });

    const hasCurrentAllChatFolder = chatFolders.some(chatFolder => {
      return isCurrentAllChatFolder(chatFolder);
    });

    if (!hasCurrentAllChatFolder) {
      log.info(`process(${version}): creating all chats chat folder`);
      window.reduxActions.chatFolders.createAllChatsChatFolder();
    }
  }

  log.info(`process(${version}): done`);
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
  const storageKeyBase64 = itemStorage.get('storageKey');
  if (!storageKeyBase64) {
    throw new Error('No storage key');
  }

  const storageKey = Bytes.fromBase64(storageKeyBase64);

  log.info(
    `fetchRemoteRecords(${storageVersion}): ` +
      `fetching remote keys count=${remoteOnlyRecords.size}`
  );

  const credentials = itemStorage.get('storageCredentials');
  const batches = chunk(Array.from(remoteOnlyRecords.keys()), MAX_READ_KEYS);

  const storageItems = (
    await pMap(
      batches,
      async (
        batch: ReadonlyArray<string>
      ): Promise<Array<Proto.IStorageItem>> => {
        const readOperation = new Proto.ReadOperation();
        readOperation.readKey = batch.map(Bytes.fromBase64);

        const storageItemsBuffer = await getStorageRecords(
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
          `process(${storageVersion}): Error decrypting storage item ${redactStorageID(base64ItemID)}`,
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
    `fetchRemoteRecords(${storageVersion}): missing remote ` +
      `keys=${JSON.stringify(redactedMissingKeys)} ` +
      `count=${missingKeys.size}`
  );

  return { decryptedItems, missingKeys };
}

async function processRemoteRecords(
  storageVersion: number,
  { decryptedItems, missingKeys }: FetchRemoteRecordsResultType
): Promise<void> {
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
  const recordsNeedingAllContacts: Array<MergeableItemType> = [];

  let prunedStorageItems = decryptedItems.filter(item => {
    const { itemType, storageID, storageRecord } = item;
    if (
      itemType === ITEM_TYPE.NOTIFICATION_PROFILE ||
      itemType === ITEM_TYPE.CHAT_FOLDER
    ) {
      recordsNeedingAllContacts.push(item);
      return false;
    }

    if (itemType === ITEM_TYPE.ACCOUNT) {
      if (accountItem !== undefined) {
        log.warn(
          `process(${storageVersion}): duplicate account ` +
            `record=${redactStorageID(storageID, storageVersion)} ` +
            `previous=${redactStorageID(accountItem.storageID, storageVersion)}`
        );
        droppedKeys.add(accountItem.storageID);
      }

      accountItem = item;
      const record = accountItem?.storageRecord.account;

      if (!record) {
        log.warn(
          `process(${storageVersion}): account record had no account data`
        );
        return false;
      }

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
      `process(${storageVersion}): dropping ` +
        `GV1 record=${redactStorageID(storageID, storageVersion)} ` +
        `GV2 record=${redactStorageID(gv2StorageID, storageVersion)} ` +
        'is in the same manifest'
    );
    droppedKeys.add(storageID);

    return false;
  });

  // Find remote contact records that:
  // - Have `remote.pni` and have `remote.e164`
  // - Match local contact that has `aci`.
  const splitPNIContacts = new Array<MergeableItemType>();
  prunedStorageItems = prunedStorageItems.filter(item => {
    const { itemType, storageRecord } = item;
    const { contact } = storageRecord;
    if (itemType !== ITEM_TYPE.CONTACT || !contact) {
      return true;
    }

    const pni = fromPniUuidBytesOrUntaggedString(
      contact.pniBinary,
      contact.pni,
      'splitPNIContacts'
    );
    if (!contact.e164 || !pni) {
      return true;
    }

    const localAci = window.ConversationController.get(pni)?.getAci();
    if (!localAci) {
      return true;
    }

    splitPNIContacts.push(item);
    return false;
  });

  try {
    log.info(
      `process(${storageVersion}): ` +
        `attempting to merge records=${prunedStorageItems.length}`
    );
    if (accountItem !== undefined) {
      log.info(
        `process(${storageVersion}): account ` +
          `record=${redactStorageID(accountItem.storageID, storageVersion)}`
      );
    }
    if (splitPNIContacts.length !== 0) {
      log.info(
        `process(${storageVersion}): ` +
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

    const mergedPrunedStorageItems =
      await mergeWithConcurrency(prunedStorageItems);

    // Merge split PNI contacts after processing remote records. If original
    // e164+ACI+PNI contact is unregistered - it is going to be split so we
    // have to make that happen first. Otherwise we will ignore ContactRecord
    // changes on these since there is already a parent "merged" contact.
    const mergedSplitPNIContacts = await mergeWithConcurrency(splitPNIContacts);

    // Merge records that need all contacts already processed beforehand. Records like
    // Chat Folders and Notification Profiles need all contacts in place since they might
    // refer to any contact.
    const mergedRecordsNeedingAllContacts = await mergeWithConcurrency(
      recordsNeedingAllContacts
    );

    // Merge Account record last since it contains references to records that need
    // to be processed first - things like pinned conversations or the user's notification
    // profile manual override.
    const mergedAccountRecord = accountItem
      ? await mergeRecord(storageVersion, accountItem)
      : undefined;

    const mergedRecords = [
      ...mergedPrunedStorageItems,
      ...mergedSplitPNIContacts,
      ...mergedRecordsNeedingAllContacts,
      ...(mergedAccountRecord ? [mergedAccountRecord] : []),
    ];

    log.info(
      `process(${storageVersion}): ` +
        `processed records=${mergedRecords.length}`
    );

    const updatedConversations = mergedRecords
      .map(record => record.updatedConversations)
      .flat()
      .map(convo => convo.attributes);
    await updateConversations(updatedConversations);

    log.info(
      `process(${storageVersion}): ` +
        `updated conversations=${updatedConversations.length}`
    );

    const needProfileFetch = mergedRecords
      .map(record => record.needProfileFetch)
      .flat();

    log.info(
      `process(${storageVersion}): ` +
        `kicking off profile fetches=${needProfileFetch.length}`
    );

    // Intentionally not awaiting
    needProfileFetch.map(convo => drop(convo.getProfiles()));

    // Collect full map of previously and currently unknown records
    const unknownRecords: Map<string, UnknownRecord> = new Map();

    const previousUnknownRecords: ReadonlyArray<UnknownRecord> =
      itemStorage.get(
        'storage-service-unknown-records',
        new Array<UnknownRecord>()
      );
    previousUnknownRecords.forEach((record: UnknownRecord) => {
      unknownRecords.set(record.storageID, record);
    });

    const newRecordsWithErrors: Array<UnknownRecord> = [];

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

      if (mergedRecord.shouldDrop) {
        droppedKeys.add(mergedRecord.storageID);
      }
    });

    const redactedDroppedKeys = Array.from(droppedKeys.values()).map(key =>
      redactStorageID(key, storageVersion)
    );
    log.info(
      `process(${storageVersion}): ` +
        `dropped keys=${JSON.stringify(redactedDroppedKeys)} ` +
        `count=${redactedDroppedKeys.length}`
    );

    // Filter out all the unknown records we're already supporting
    const newUnknownRecords = Array.from(unknownRecords.values()).filter(
      (record: UnknownRecord) => !validRecordTypes.has(record.itemType)
    );
    const redactedNewUnknowns = newUnknownRecords.map(redactExtendedStorageID);

    log.info(
      `process(${storageVersion}): ` +
        `unknown records=${JSON.stringify(redactedNewUnknowns)} ` +
        `count=${redactedNewUnknowns.length}`
    );
    await itemStorage.put('storage-service-unknown-records', newUnknownRecords);

    const redactedErrorRecords = newRecordsWithErrors.map(
      redactExtendedStorageID
    );
    log.info(
      `process(${storageVersion}): ` +
        `error records=${JSON.stringify(redactedErrorRecords)} ` +
        `count=${redactedErrorRecords.length}`
    );
    // Refresh the list of records that had errors with every push, that way
    // this list doesn't grow unbounded and we keep the list of storage keys
    // fresh.
    await itemStorage.put(
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
      `process(${storageVersion}): ` +
        `pending deletes=${JSON.stringify(redactedPendingDeletes)} ` +
        `count=${redactedPendingDeletes.length}`
    );
    await itemStorage.put('storage-service-pending-deletes', pendingDeletes);
  } catch (err) {
    log.error(
      `process(${storageVersion}): failed to process remote records`,
      Errors.toLogFormat(err)
    );
  }
}

async function sync({
  reason,
}: {
  reason: string;
}): Promise<Proto.ManifestRecord | undefined> {
  if (!itemStorage.get('storageKey')) {
    const masterKeyBase64 = itemStorage.get('masterKey');
    if (!masterKeyBase64) {
      log.error(`sync(${reason}): Cannot start; no storage or master key!`);
      return;
    }

    const masterKey = Bytes.fromBase64(masterKeyBase64);
    const storageKeyBase64 = Bytes.toBase64(deriveStorageServiceKey(masterKey));
    await itemStorage.put('storageKey', storageKeyBase64);

    log.warn('sync: fixed storage key');
  }

  log.info(`sync: starting... reason=${reason}`);

  let manifest: Proto.ManifestRecord | undefined;
  try {
    // If we've previously interacted with storage service, update 'fetchComplete' record
    const previousFetchComplete = itemStorage.get('storageFetchComplete');
    const manifestFromStorage = itemStorage.get('manifestVersion');
    if (!previousFetchComplete && isNumber(manifestFromStorage)) {
      await itemStorage.put('storageFetchComplete', true);
    }

    const localManifestVersion = manifestFromStorage || 0;

    log.info(`sync: fetching latest after version=${localManifestVersion}`);
    manifest = await fetchManifest(localManifestVersion);

    // Guarding against no manifests being returned, everything should be ok
    if (!manifest) {
      log.info(`sync: no updates, version=${localManifestVersion}`);
      return undefined;
    }

    strictAssert(manifest.version != null, 'Manifest without version');
    const version = manifest.version?.toNumber() ?? 0;

    await window.waitForEmptyEventQueue();

    log.info(
      `sync: updating to remoteVersion=${version} ` +
        `sourceDevice=${manifest.sourceDevice ?? '?'} from ` +
        `version=${localManifestVersion}`
    );

    await processManifest(manifest, version);

    log.info(`sync: updated to version=${version}`);

    await itemStorage.put('manifestVersion', version);
    if (Bytes.isNotEmpty(manifest.recordIkm)) {
      await itemStorage.put('manifestRecordIkm', manifest.recordIkm);
    } else {
      await itemStorage.remove('manifestRecordIkm');
    }

    // We now know that we've successfully completed a storage service fetch
    await itemStorage.put('storageFetchComplete', true);

    if (window.SignalCI) {
      window.SignalCI.handleEvent('storageServiceComplete', {
        manifestVersion: version,
      });
    }

    log.info('sync: complete');
  } catch (err) {
    log.error('sync: error processing manifest', Errors.toLogFormat(err));
  }

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

  if (!itemStorage.get('storageKey')) {
    // requesting new keys runs the sync job which will detect the conflict
    // and re-run the upload job once we're merged and up-to-date.
    backOff.reset();

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(`${logId}: We are primary device; not sending key sync request`);
      return;
    }

    if (!isRegistrationDone()) {
      log.warn(`${logId}: no storageKey, unlinked`);
      return;
    }

    log.info(`${logId}: no storageKey, requesting new keys`);
    await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());

    return;
  }

  let previousManifest: Proto.ManifestRecord | undefined;
  if (!fromSync) {
    // Syncing before we upload so that we repair any unknown records and
    // records with errors as well as ensure that we have the latest up to date
    // manifest.
    previousManifest = await sync({
      reason: `upload/${reason}`,
    });
  }

  const localManifestVersion = itemStorage.get('manifestVersion', 0);
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
    await itemStorage.put('storage-service-pending-deletes', []);
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
let storageServiceNeedsUploadAfterEnabled = false;

export function enableStorageService(): void {
  if (storageServiceEnabled) {
    return;
  }

  storageServiceEnabled = true;
  log.info('enableStorageService');

  if (storageServiceNeedsUploadAfterEnabled) {
    storageServiceUploadJob({
      reason: 'storageServiceNeedsUploadAfterEnabled',
    });
  }
}

export function disableStorageService(reason: string): void {
  if (!storageServiceEnabled) {
    return;
  }

  log.info(`disableStorageService: ${reason}`);
  storageServiceEnabled = false;
}

export async function eraseAllStorageServiceState({
  keepUnknownFields = false,
}: { keepUnknownFields?: boolean } = {}): Promise<void> {
  log.info('eraseAllStorageServiceState: starting...');

  // First, update high-level storage service metadata
  await Promise.all([
    itemStorage.remove('manifestVersion'),
    itemStorage.remove('manifestRecordIkm'),
    keepUnknownFields
      ? Promise.resolve()
      : itemStorage.remove('storage-service-unknown-records'),
    itemStorage.remove('storageCredentials'),
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
  window.ConversationController.getAll().forEach(conversation => {
    conversation.set({
      storageID: undefined,
      needsStorageServiceSync: undefined,
      storageUnknownFields: undefined,
    });
  });

  // Then make sure outstanding conversation saves are flushed
  await flushUpdateConversationBatcher();

  // Then make sure that all previously-outstanding database saves are flushed
  await getItemById('manifestVersion');

  // Finally, we update the database directly for all record types:
  await eraseStorageServiceState();

  log.info('eraseAllStorageServiceState: complete');
}

export async function reprocessUnknownFields(): Promise<void> {
  ourProfileKeyService.blockGetWithPromise(
    storageJobQueue(async () => {
      const version = itemStorage.get('manifestVersion') ?? 0;

      log.info(`reprocessUnknownFields(${version}): starting`);

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

      await processRemoteRecords(version, {
        decryptedItems: newRecords,
        missingKeys: new Set(),
      });

      log.info(`reprocessUnknownFields(${version}): done`);
    })
  );
}

export function storageServiceUploadJobAfterEnabled({
  reason,
}: {
  reason: string;
}): void {
  if (storageServiceEnabled) {
    return storageServiceUploadJob({ reason });
  }
  log.info(
    `storageServiceNeedsUploadAfterEnabled(${reason}): waiting until enabled`
  );
  storageServiceNeedsUploadAfterEnabled = true;
}

export const storageServiceUploadJob = debounce(
  ({ reason }: { reason: string }) => {
    if (!storageServiceEnabled) {
      log.info(`storageServiceUploadJob(${reason}): called before enabled `);
      return;
    }

    void storageJobQueue(
      async () => {
        await upload({ reason: `storageServiceUploadJob/${reason}` });
      },
      `upload v${itemStorage.get('manifestVersion')}`
    );
  },
  isMockEnvironment() ? 0 : 500
);

export const runStorageServiceSyncJob = debounce(
  ({ reason }: { reason: string }) => {
    if (!storageServiceEnabled) {
      log.info(`runStorageServiceSyncJob(${reason}): called before enabled`);
      return;
    }

    ourProfileKeyService.blockGetWithPromise(
      storageJobQueue(
        async () => {
          await sync({ reason });

          // Notify listeners about sync completion
          window.Whisper.events.emit('storageService:syncComplete');
        },
        `sync v${itemStorage.get('manifestVersion')}`
      )
    );
  },
  isMockEnvironment() ? 0 : 500
);

export const addPendingDelete = (item: ExtendedStorageID): void => {
  void storageJobQueue(
    async () => {
      const storedPendingDeletes = itemStorage.get(
        'storage-service-pending-deletes',
        []
      );
      await itemStorage.put('storage-service-pending-deletes', [
        ...storedPendingDeletes,
        item,
      ]);
    },
    `addPendingDelete(${redactExtendedStorageID(item)})`
  );
};
