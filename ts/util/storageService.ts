/* tslint:disable no-backbone-get-set-outside-model */
import _ from 'lodash';
import PQueue from 'p-queue';

import Crypto from '../textsecure/Crypto';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  constantTimeEqual,
  deriveStorageItemKey,
  deriveStorageManifestKey,
} from '../Crypto';
import {
  AccountRecordClass,
  ContactRecordClass,
  GroupV1RecordClass,
  ManifestRecordClass,
  StorageItemClass,
} from '../textsecure.d';
import { ConversationType } from '../window.d';

function fromRecordVerified(verified: number): number {
  const VERIFIED_ENUM = window.textsecure.storage.protocol.VerifiedStatus;
  const STATE_ENUM = window.textsecure.protobuf.ContactRecord.IdentityState;

  switch (verified) {
    case STATE_ENUM.VERIFIED:
      return VERIFIED_ENUM.VERIFIED;
    case STATE_ENUM.UNVERIFIED:
      return VERIFIED_ENUM.UNVERIFIED;
    default:
      return VERIFIED_ENUM.DEFAULT;
  }
}

async function fetchManifest(manifestVersion: string) {
  window.log.info('storageService.fetchManifest');
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

    // If we don't get a value we're assuming we're receiving a 204
    // it would be nice to get an actual e.code 204 and check against that.
    if (!encryptedManifest.value || !encryptedManifest.version) {
      window.log.info('storageService.fetchManifest: nothing changed');
      return;
    }

    const storageKeyBase64 = window.storage.get('storageKey');
    const storageKey = base64ToArrayBuffer(storageKeyBase64);
    const storageManifestKey = await deriveStorageManifestKey(
      storageKey,
      encryptedManifest.version.toNumber()
    );

    const decryptedManifest = await Crypto.decryptProfile(
      encryptedManifest.value.toArrayBuffer(),
      storageManifestKey
    );

    return window.textsecure.protobuf.ManifestRecord.decode(decryptedManifest);
  } catch (err) {
    window.log.error(`storageService.fetchManifest: ${err}`);

    if (err.code === 404) {
      // No manifest exists, we create one
      return { version: 0, keys: [] };
    } else if (err.code === 204) {
      // noNewerManifest we're ok
      return;
    }

    throw err;
  }
}

async function mergeGroupV1Record(
  storageID: string,
  groupV1Record: GroupV1RecordClass
): Promise<void> {
  window.log.info(`storageService.mergeGroupV1Record: merging ${storageID}`);

  if (!groupV1Record.id) {
    window.log.info(
      `storageService.mergeGroupV1Record: no ID for ${storageID}`
    );
    return;
  }

  const conversation = await window.ConversationController.getOrCreateAndWait(
    groupV1Record.id.toBinary(),
    'group'
  );

  conversation.set({
    isArchived: Boolean(groupV1Record.archived),
    storageID,
  });

  window.Signal.Data.updateConversation(conversation.attributes);

  window.log.info(`storageService.mergeGroupV1Record: merged ${storageID}`);
}

async function mergeContactRecord(
  storageID: string,
  contactRecord: ContactRecordClass
): Promise<void> {
  window.normalizeUuids(
    contactRecord,
    ['serviceUuid'],
    'storageService.mergeContactRecord'
  );

  if (!contactRecord.serviceE164) {
    window.log.info(
      `storageService.mergeContactRecord: no E164 for ${storageID}, uuid: ${contactRecord.serviceUuid}. Dropping record`
    );
    return;
  }

  const id = contactRecord.serviceE164 || contactRecord.serviceUuid;

  if (!id) {
    window.log.info(
      `storageService.mergeContactRecord: no ID for ${storageID}`
    );
    return;
  }

  window.log.info(`storageService.mergeContactRecord: merging ${storageID}`);

  const conversation = await window.ConversationController.getOrCreateAndWait(
    id,
    'private'
  );

  if (contactRecord.blocked === true) {
    window.storage.addBlockedNumber(conversation.id);
  } else if (contactRecord.blocked === false) {
    window.storage.removeBlockedNumber(conversation.id);
  }

  const verified = contactRecord.identityState
    ? fromRecordVerified(contactRecord.identityState)
    : window.textsecure.storage.protocol.VerifiedStatus.DEFAULT;

  conversation.set({
    isArchived: Boolean(contactRecord.archived),
    profileFamilyName: contactRecord.familyName,
    profileKey: contactRecord.profileKey
      ? arrayBufferToBase64(contactRecord.profileKey.toArrayBuffer())
      : null,
    profileName: contactRecord.givenName,
    profileSharing: Boolean(contactRecord.whitelisted),
    storageID,
    verified,
  });

  if (
    contactRecord.serviceUuid &&
    (!conversation.get('uuid') ||
      conversation.get('uuid') !== contactRecord.serviceUuid)
  ) {
    window.log.info(
      `storageService.mergeContactRecord: updating UUID ${storageID}`
    );
    conversation.set({ uuid: contactRecord.serviceUuid });
  }

  if (contactRecord.serviceE164 && !conversation.get('e164')) {
    window.log.info(
      `storageService.mergeContactRecord: updating E164 ${storageID}`
    );
    conversation.set({ e164: contactRecord.serviceE164 });
  }

  const identityKey = await window.textsecure.storage.protocol.loadIdentityKey(
    conversation.id
  );

  const identityKeyChanged =
    identityKey && contactRecord.identityKey
      ? !constantTimeEqual(
          identityKey,
          contactRecord.identityKey.toArrayBuffer()
        )
      : false;

  if (identityKeyChanged && contactRecord.identityKey) {
    await window.textsecure.storage.protocol.processVerifiedMessage(
      conversation.id,
      verified,
      contactRecord.identityKey.toArrayBuffer()
    );
  } else if (conversation.get('verified')) {
    await window.textsecure.storage.protocol.setVerified(
      conversation.id,
      verified
    );
  }

  window.Signal.Data.updateConversation(conversation.attributes);

  window.log.info(`storageService.mergeContactRecord: merged ${storageID}`);
}

async function mergeAccountRecord(
  storageID: string,
  accountRecord: AccountRecordClass
): Promise<void> {
  window.log.info(`storageService.mergeAccountRecord: merging ${storageID}`);

  const {
    profileKey,
    linkPreviews,
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
    return;
  }

  const conversation = await window.ConversationController.getOrCreateAndWait(
    ourID,
    'private'
  );

  conversation.set({
    profileFamilyName: accountRecord.familyName,
    profileKey: accountRecord.profileKey
      ? arrayBufferToBase64(accountRecord.profileKey.toArrayBuffer())
      : null,
    profileName: accountRecord.givenName,
    storageID,
  });

  window.Signal.Data.updateConversation(conversation.attributes);

  window.log.info(
    `storageService.mergeAccountRecord: merged profile ${storageID}`
  );
}

// tslint:disable-next-line max-func-body-length
async function processManifest(
  manifest: ManifestRecordClass
): Promise<boolean> {
  const credentials = window.storage.get('storageCredentials');
  const storageKeyBase64 = window.storage.get('storageKey');
  const storageKey = base64ToArrayBuffer(storageKeyBase64);

  const remoteKeysTypeMap = new Map();
  manifest.keys.forEach(key => {
    remoteKeysTypeMap.set(
      arrayBufferToBase64(key.raw.toArrayBuffer()),
      key.type
    );
  });

  const localKeys = window
    .getConversations()
    .map((conversation: ConversationType) => conversation.get('storageID'))
    .filter(Boolean);
  window.log.info(
    `storageService.processManifest localKeys.length ${localKeys.length}`
  );

  const remoteKeys = Array.from(remoteKeysTypeMap.keys());

  const remoteOnly = remoteKeys.filter(
    (key: string) => !localKeys.includes(key)
  );

  window.log.info(
    `storageService.processManifest remoteOnly.length ${remoteOnly.length}`
  );

  const readOperation = new window.textsecure.protobuf.ReadOperation();
  readOperation.readKey = remoteOnly.map(base64ToArrayBuffer);

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
    return false;
  }

  const queue = new PQueue({ concurrency: 4 });

  const mergedItems = storageItems.items.map(
    (storageRecordWrapper: StorageItemClass) => async () => {
      const { key, value: storageItemCiphertext } = storageRecordWrapper;

      if (!key || !storageItemCiphertext) {
        return;
      }

      const base64ItemID = arrayBufferToBase64(key.toArrayBuffer());

      const storageItemKey = await deriveStorageItemKey(
        storageKey,
        base64ItemID
      );

      const storageItemPlaintext = await Crypto.decryptProfile(
        storageItemCiphertext.toArrayBuffer(),
        storageItemKey
      );
      const storageRecord = window.textsecure.protobuf.StorageRecord.decode(
        storageItemPlaintext
      );

      const itemType = remoteKeysTypeMap.get(base64ItemID);

      const ITEM_TYPE =
        window.textsecure.protobuf.ManifestRecord.Identifier.Type;

      try {
        if (itemType === ITEM_TYPE.UNKNOWN) {
          window.log.info('storageService.processManifest: Unknown item type');
        } else if (itemType === ITEM_TYPE.CONTACT && storageRecord.contact) {
          await mergeContactRecord(base64ItemID, storageRecord.contact);
        } else if (itemType === ITEM_TYPE.GROUPV1 && storageRecord.groupV1) {
          await mergeGroupV1Record(base64ItemID, storageRecord.groupV1);
        } else if (itemType === ITEM_TYPE.GROUPV2 && storageRecord.groupV2) {
          window.log.info(
            'storageService.processManifest: Skipping GroupV2 item'
          );
        } else if (itemType === ITEM_TYPE.ACCOUNT && storageRecord.account) {
          await mergeAccountRecord(base64ItemID, storageRecord.account);
        }
      } catch (err) {
        window.log.error(
          `storageService.processManifest: merging record failed ${base64ItemID}`
        );
      }
    }
  );

  try {
    await queue.addAll(mergedItems);
    await queue.onEmpty();
    return true;
  } catch (err) {
    window.log.error('storageService.processManifest: merging failed');
    return false;
  }
}

export async function runStorageServiceSyncJob() {
  const localManifestVersion = '0'; // window.storage.get('manifestVersion') || 0;

  let manifest;
  try {
    manifest = await fetchManifest(localManifestVersion);

    // Guarding against no manifests being returned, everything should be ok
    if (!manifest) {
      return;
    }
  } catch (err) {
    // We are supposed to retry here if it's a retryable error
    window.log.error(
      `storageService.runStorageServiceSyncJob: failed! ${
        err && err.stack ? err.stack : String(err)
      }`
    );
    return;
  }

  const version = manifest.version.toNumber();

  window.log.info(
    `runStorageServiceSyncJob: manifest versions - previous: ${localManifestVersion}, current: ${version}`
  );

  const shouldUpdateVersion = await processManifest(manifest);

  if (shouldUpdateVersion) {
    return;
    window.storage.put('manifestVersion', version);
  }
}
