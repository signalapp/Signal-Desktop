/* global
  textsecure,
  Signal,
  log,
  navigator,
  reduxStore,
  reduxActions,
  URL
*/

const BLESSED_PACKS = {};

const { isNumber, pick, reject, groupBy, values } = require('lodash');
const pMap = require('p-map');
const Queue = require('p-queue');
const qs = require('qs');

const { makeLookup } = require('../../ts/util/makeLookup');
const { base64ToArrayBuffer, deriveStickerPackKey } = require('./crypto');
const {
  addStickerPackReference,
  createOrUpdateSticker,
  createOrUpdateStickerPack,
  deleteStickerPack,
  deleteStickerPackReference,
  getAllStickerPacks,
  getAllStickers,
  getRecentStickers,
  updateStickerPackStatus,
} = require('./data');

module.exports = {
  BLESSED_PACKS,
  copyStickerToAttachments,
  deletePack,
  deletePackReference,
  downloadStickerPack,
  downloadEphemeralPack,
  getDataFromLink,
  getInitialState,
  getInstalledStickerPacks,
  getSticker,
  getStickerPack,
  getStickerPackStatus,
  load,
  maybeDeletePack,
  downloadQueuedPacks,
  redactPackId,
  removeEphemeralPack,
  savePackMetadata,
};

let initialState = null;
let packsToDownload = null;
const downloadQueue = new Queue({ concurrency: 1 });

async function load() {
  const [packs, recentStickers] = await Promise.all([
    getPacksForRedux(),
    getRecentStickersForRedux(),
  ]);

  initialState = {
    packs,
    recentStickers,
    blessedPacks: BLESSED_PACKS,
  };

  packsToDownload = capturePacksToDownload(packs);
}

function getDataFromLink(link) {
  const { hash } = new URL(link);
  if (!hash) {
    return null;
  }

  const data = hash.slice(1);
  const params = qs.parse(data);

  return {
    id: params.pack_id,
    key: params.pack_key,
  };
}

function getInstalledStickerPacks() {
  const state = reduxStore.getState();
  const { stickers } = state;
  const { packs } = stickers;
  if (!packs) {
    return [];
  }

  const items = Object.values(packs);
  return items.filter(pack => pack.status === 'installed');
}

function downloadQueuedPacks() {
  const ids = Object.keys(packsToDownload);
  ids.forEach(id => {
    const { key, status } = packsToDownload[id];

    // The queuing is done inside this function, no need to await here
    downloadStickerPack(id, key, { finalStatus: status });
  });

  packsToDownload = {};
}

function capturePacksToDownload(existingPackLookup) {
  const toDownload = Object.create(null);

  // First, ensure that blessed packs are in good shape
  const blessedIds = Object.keys(BLESSED_PACKS);
  blessedIds.forEach(id => {
    const existing = existingPackLookup[id];
    if (
      !existing ||
      (existing.status !== 'downloaded' && existing.status !== 'installed')
    ) {
      toDownload[id] = {
        id,
        ...BLESSED_PACKS[id],
      };
    }
  });

  // Then, find error cases in packs we already know about
  const existingIds = Object.keys(existingPackLookup);
  existingIds.forEach(id => {
    if (toDownload[id]) {
      return;
    }

    const existing = existingPackLookup[id];

    // These packs should never end up in the database, but if they do we'll delete them
    if (existing.status === 'ephemeral') {
      deletePack(id);
      return;
    }

    // We don't automatically download these; not until a user action kicks it off
    if (existing.status === 'known') {
      return;
    }

    if (doesPackNeedDownload(existing)) {
      const status =
        existing.attemptedStatus === 'installed' ? 'installed' : null;
      toDownload[id] = {
        id,
        key: existing.key,
        status,
      };
    }
  });

  return toDownload;
}

function doesPackNeedDownload(pack) {
  if (!pack) {
    return true;
  }

  const { status, stickerCount } = pack;
  const stickersDownloaded = Object.keys(pack.stickers || {}).length;

  if (
    (status === 'installed' || status === 'downloaded') &&
    stickerCount > 0 &&
    stickersDownloaded >= stickerCount
  ) {
    return false;
  }

  // If we don't understand a pack's status, we'll download it
  // If a pack has any other status, we'll download it
  // If a pack has zero stickers in it, we'll download it
  // If a pack doesn't have enough downloaded stickers, we'll download it

  return true;
}

async function getPacksForRedux() {
  const [packs, stickers] = await Promise.all([
    getAllStickerPacks(),
    getAllStickers(),
  ]);

  const stickersByPack = groupBy(stickers, sticker => sticker.packId);
  const fullSet = packs.map(pack => ({
    ...pack,
    stickers: makeLookup(stickersByPack[pack.id] || [], 'id'),
  }));

  return makeLookup(fullSet, 'id');
}

async function getRecentStickersForRedux() {
  const recent = await getRecentStickers();
  return recent.map(sticker => ({
    packId: sticker.packId,
    stickerId: sticker.id,
  }));
}

function getInitialState() {
  return initialState;
}

function redactPackId(packId) {
  return `[REDACTED]${packId.slice(-3)}`;
}

function getReduxStickerActions() {
  const actions = reduxActions;

  if (actions && actions.stickers) {
    return actions.stickers;
  }

  return {};
}

async function decryptSticker(packKey, ciphertext) {
  const binaryKey = base64ToArrayBuffer(packKey);
  const derivedKey = await deriveStickerPackKey(binaryKey);
  const plaintext = await textsecure.crypto.decryptAttachment(
    ciphertext,
    derivedKey
  );

  return plaintext;
}

async function downloadSticker(packId, packKey, proto, options) {
  const { ephemeral } = options || {};

  const ciphertext = await textsecure.messaging.getSticker(packId, proto.id);
  const plaintext = await decryptSticker(packKey, ciphertext);

  const sticker = ephemeral
    ? await Signal.Migrations.processNewEphemeralSticker(plaintext, options)
    : await Signal.Migrations.processNewSticker(plaintext, options);

  return {
    ...pick(proto, ['id', 'emoji']),
    ...sticker,
    packId,
  };
}

async function savePackMetadata(packId, packKey, options = {}) {
  const { messageId } = options;

  const existing = getStickerPack(packId);
  if (existing) {
    return;
  }

  const { stickerPackAdded } = getReduxStickerActions();
  const pack = {
    id: packId,
    key: packKey,
    status: 'known',
  };
  stickerPackAdded(pack);

  await createOrUpdateStickerPack(pack);
  if (messageId) {
    await addStickerPackReference(messageId, packId);
  }
}

async function removeEphemeralPack(packId) {
  const existing = getStickerPack(packId);
  if (
    existing.status !== 'ephemeral' &&
    !(existing.status === 'error' && existing.attemptedStatus === 'ephemeral')
  ) {
    return;
  }

  const { removeStickerPack } = getReduxStickerActions();
  removeStickerPack(packId);

  const stickers = values(existing.stickers);
  const paths = stickers.map(sticker => sticker.path);
  await pMap(paths, Signal.Migrations.deleteTempFile, {
    concurrency: 3,
  });

  // Remove it from database in case it made it there
  await deleteStickerPack(packId);
}

async function downloadEphemeralPack(packId, packKey) {
  const {
    stickerAdded,
    stickerPackAdded,
    stickerPackUpdated,
  } = getReduxStickerActions();

  const existingPack = getStickerPack(packId);
  if (existingPack) {
    log.warn(
      `Ephemeral download for pack ${redactPackId(
        packId
      )} requested, we already know about it. Skipping.`
    );
    return;
  }

  try {
    // Synchronous placeholder to help with race conditions
    const placeholder = {
      id: packId,
      key: packKey,
      status: 'ephemeral',
    };
    stickerPackAdded(placeholder);

    const ciphertext = await textsecure.messaging.getStickerPackManifest(
      packId
    );
    const plaintext = await decryptSticker(packKey, ciphertext);
    const proto = textsecure.protobuf.StickerPack.decode(plaintext);
    const firstStickerProto = proto.stickers ? proto.stickers[0] : null;
    const stickerCount = proto.stickers.length;

    const coverProto = proto.cover || firstStickerProto;
    const coverStickerId = coverProto ? coverProto.id : null;

    if (!coverProto || !isNumber(coverStickerId)) {
      throw new Error(
        `Sticker pack ${redactPackId(
          packId
        )} is malformed - it has no cover, and no stickers`
      );
    }

    const nonCoverStickers = reject(
      proto.stickers,
      sticker => !isNumber(sticker.id) || sticker.id === coverStickerId
    );

    const coverIncludedInList = nonCoverStickers.length < stickerCount;

    const pack = {
      id: packId,
      key: packKey,
      coverStickerId,
      stickerCount,
      status: 'ephemeral',
      ...pick(proto, ['title', 'author']),
    };
    stickerPackAdded(pack);

    const downloadStickerJob = async stickerProto => {
      const stickerInfo = await downloadSticker(packId, packKey, stickerProto, {
        ephemeral: true,
      });
      const sticker = {
        ...stickerInfo,
        isCoverOnly: !coverIncludedInList && stickerInfo.id === coverStickerId,
      };

      const statusCheck = getStickerPackStatus(packId);
      if (statusCheck !== 'ephemeral') {
        throw new Error(
          `Ephemeral download for pack ${redactPackId(
            packId
          )} interrupted by status change. Status is now ${statusCheck}.`
        );
      }

      stickerAdded(sticker);
    };

    // Download the cover first
    await downloadStickerJob(coverProto);

    // Then the rest
    await pMap(nonCoverStickers, downloadStickerJob, { concurrency: 3 });
  } catch (error) {
    // Because the user could install this pack while we are still downloading this
    //   ephemeral pack, we don't want to go change its status unless we're still in
    //   ephemeral mode.
    const statusCheck = getStickerPackStatus(packId);
    if (statusCheck === 'ephemeral') {
      stickerPackUpdated(packId, {
        attemptedStatus: 'ephemeral',
        status: 'error',
      });
    }
    log.error(
      `Ephemeral download error for sticker pack ${redactPackId(packId)}:`,
      error && error.stack ? error.stack : error
    );
  }
}

async function downloadStickerPack(packId, packKey, options = {}) {
  // This will ensure that only one download process is in progress at any given time
  return downloadQueue.add(async () => {
    try {
      await doDownloadStickerPack(packId, packKey, options);
    } catch (error) {
      log.error(
        'doDownloadStickerPack threw an error:',
        error && error.stack ? error.stack : error
      );
    }
  });
}

async function doDownloadStickerPack(packId, packKey, options = {}) {
  const { messageId, fromSync } = options;
  const {
    stickerAdded,
    stickerPackAdded,
    stickerPackUpdated,
    installStickerPack,
  } = getReduxStickerActions();

  const finalStatus = options.finalStatus || 'downloaded';
  if (finalStatus !== 'downloaded' && finalStatus !== 'installed') {
    throw new Error(
      `doDownloadStickerPack: invalid finalStatus of ${finalStatus} requested.`
    );
  }

  const existing = getStickerPack(packId);
  if (!doesPackNeedDownload(existing)) {
    log.warn(
      `Download for pack ${redactPackId(
        packId
      )} requested, but it does not need re-download. Skipping.`
    );
    return;
  }

  // We don't count this as an attempt if we're offline
  const attemptIncrement = navigator.onLine ? 1 : 0;
  const downloadAttempts =
    (existing ? existing.downloadAttempts || 0 : 0) + attemptIncrement;
  if (downloadAttempts > 3) {
    log.warn(
      `Refusing to attempt another download for pack ${redactPackId(
        packId
      )}, attempt number ${downloadAttempts}`
    );

    if (existing.status !== 'error') {
      await updateStickerPackStatus(packId, 'error');
      stickerPackUpdated(packId, {
        status: 'error',
      });
    }

    return;
  }

  let coverProto;
  let coverStickerId;
  let coverIncludedInList;
  let nonCoverStickers;

  try {
    // Synchronous placeholder to help with race conditions
    const placeholder = {
      id: packId,
      key: packKey,
      attemptedStatus: finalStatus,
      downloadAttempts,
      status: 'pending',
    };
    stickerPackAdded(placeholder);

    const ciphertext = await textsecure.messaging.getStickerPackManifest(
      packId
    );
    const plaintext = await decryptSticker(packKey, ciphertext);
    const proto = textsecure.protobuf.StickerPack.decode(plaintext);
    const firstStickerProto = proto.stickers ? proto.stickers[0] : null;
    const stickerCount = proto.stickers.length;

    coverProto = proto.cover || firstStickerProto;
    coverStickerId = coverProto ? coverProto.id : null;

    if (!coverProto || !isNumber(coverStickerId)) {
      throw new Error(
        `Sticker pack ${redactPackId(
          packId
        )} is malformed - it has no cover, and no stickers`
      );
    }

    nonCoverStickers = reject(
      proto.stickers,
      sticker => !isNumber(sticker.id) || sticker.id === coverStickerId
    );

    coverIncludedInList = nonCoverStickers.length < stickerCount;

    // status can be:
    //   - 'known'
    //   - 'ephemeral' (should not hit database)
    //   - 'pending'
    //   - 'downloaded'
    //   - 'error'
    //   - 'installed'
    const pack = {
      id: packId,
      key: packKey,
      attemptedStatus: finalStatus,
      coverStickerId,
      downloadAttempts,
      stickerCount,
      status: 'pending',
      ...pick(proto, ['title', 'author']),
    };
    await createOrUpdateStickerPack(pack);
    stickerPackAdded(pack);

    if (messageId) {
      await addStickerPackReference(messageId, packId);
    }
  } catch (error) {
    log.error(
      `Error downloading manifest for sticker pack ${redactPackId(packId)}:`,
      error && error.stack ? error.stack : error
    );

    const pack = {
      id: packId,
      key: packKey,
      attemptedStatus: finalStatus,
      downloadAttempts,
      status: 'error',
    };
    await createOrUpdateStickerPack(pack);
    stickerPackAdded(pack);

    return;
  }

  // We have a separate try/catch here because we're starting to download stickers here
  //   and we want to preserve more of the pack on an error.
  try {
    const downloadStickerJob = async stickerProto => {
      const stickerInfo = await downloadSticker(packId, packKey, stickerProto);
      const sticker = {
        ...stickerInfo,
        isCoverOnly: !coverIncludedInList && stickerInfo.id === coverStickerId,
      };
      await createOrUpdateSticker(sticker);
      stickerAdded(sticker);
    };

    // Download the cover first
    await downloadStickerJob(coverProto);

    // Then the rest
    await pMap(nonCoverStickers, downloadStickerJob, { concurrency: 3 });

    // Allow for the user marking this pack as installed in the middle of our download;
    //   don't overwrite that status.
    const existingStatus = getStickerPackStatus(packId);
    if (existingStatus === 'installed') {
      return;
    }

    if (finalStatus === 'installed') {
      await installStickerPack(packId, packKey, { fromSync });
    } else {
      // Mark the pack as complete
      await updateStickerPackStatus(packId, finalStatus);
      stickerPackUpdated(packId, {
        status: finalStatus,
      });
    }
  } catch (error) {
    log.error(
      `Error downloading stickers for sticker pack ${redactPackId(packId)}:`,
      error && error.stack ? error.stack : error
    );

    const errorStatus = 'error';
    await updateStickerPackStatus(packId, errorStatus);
    if (stickerPackUpdated) {
      stickerPackUpdated(packId, {
        attemptedStatus: finalStatus,
        status: errorStatus,
      });
    }
  }
}

function getStickerPack(packId) {
  const state = reduxStore.getState();
  const { stickers } = state;
  const { packs } = stickers;
  if (!packs) {
    return null;
  }

  return packs[packId];
}

function getStickerPackStatus(packId) {
  const pack = getStickerPack(packId);
  if (!pack) {
    return null;
  }

  return pack.status;
}

function getSticker(packId, stickerId) {
  const state = reduxStore.getState();
  const { stickers } = state;
  const { packs } = stickers;
  const pack = packs[packId];

  if (!pack || !pack.stickers) {
    return null;
  }

  return pack.stickers[stickerId];
}

async function copyStickerToAttachments(packId, stickerId) {
  const sticker = getSticker(packId, stickerId);
  if (!sticker) {
    return null;
  }

  const { path } = sticker;
  const absolutePath = Signal.Migrations.getAbsoluteStickerPath(path);
  const newPath = await Signal.Migrations.copyIntoAttachmentsDirectory(
    absolutePath
  );

  return {
    ...sticker,
    path: newPath,
  };
}

// In the case where a sticker pack is uninstalled, we want to delete it if there are no
//   more references left. We'll delete a nonexistent reference, then check if there are
//   any references left, just like usual.
async function maybeDeletePack(packId) {
  // This hardcoded string is fine because message ids are GUIDs
  await deletePackReference('NOT-USED', packId);
}

// We don't generally delete packs outright; we just remove references to them, and if
//   the last reference is deleted, we finally then remove the pack itself from database
//   and from disk.
async function deletePackReference(messageId, packId) {
  const isBlessed = Boolean(BLESSED_PACKS[packId]);
  if (isBlessed) {
    return;
  }

  // This call uses locking to prevent race conditions with other reference removals,
  //   or an incoming message creating a new message->pack reference
  const paths = await deleteStickerPackReference(messageId, packId);

  // If we don't get a list of paths back, then the sticker pack was not deleted
  if (!paths) {
    return;
  }

  const { removeStickerPack } = getReduxStickerActions();
  removeStickerPack(packId);

  await pMap(paths, Signal.Migrations.deleteSticker, {
    concurrency: 3,
  });
}

// The override; doesn't honor our ref-counting scheme - just deletes it all.
async function deletePack(packId) {
  const isBlessed = Boolean(BLESSED_PACKS[packId]);
  if (isBlessed) {
    return;
  }

  // This call uses locking to prevent race conditions with other reference removals,
  //   or an incoming message creating a new message->pack reference
  const paths = await deleteStickerPack(packId);

  const { removeStickerPack } = getReduxStickerActions();
  removeStickerPack(packId);

  await pMap(paths, Signal.Migrations.deleteSticker, {
    concurrency: 3,
  });
}
