/* global
  textsecure,
  Signal,
  log,
  reduxStore,
  reduxActions,
  URL
*/

const BLESSED_PACKS = {};

const { isNumber, pick, reject, groupBy } = require('lodash');
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

  const values = Object.values(packs);
  return values.filter(pack => pack.status === 'installed');
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
      (existing.status !== 'advertised' && existing.status !== 'installed')
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
    if (doesPackNeedDownload(existing)) {
      toDownload[id] = {
        id,
        key: existing.key,
        status: existing.attemptedStatus,
      };
    }
  });

  return toDownload;
}

function doesPackNeedDownload(pack) {
  if (!pack) {
    return true;
  }

  const stickerCount = Object.keys(pack.stickers || {}).length;
  return (
    !pack.status ||
    pack.status === 'error' ||
    pack.status === 'pending' ||
    !pack.stickerCount ||
    stickerCount < pack.stickerCount
  );
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

async function downloadSticker(packId, packKey, proto) {
  const ciphertext = await textsecure.messaging.getSticker(packId, proto.id);
  const plaintext = await decryptSticker(packKey, ciphertext);
  const sticker = await Signal.Migrations.processNewSticker(plaintext);

  return {
    ...pick(proto, ['id', 'emoji']),
    ...sticker,
    packId,
  };
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

  const finalStatus = options.finalStatus || 'advertised';

  const existing = getStickerPack(packId);
  if (!doesPackNeedDownload(existing)) {
    log.warn(
      `Download for pack ${redactPackId(
        packId
      )} requested, but it does not need re-download. Skipping.`
    );
    return;
  }

  const downloadAttempts = (existing ? existing.downloadAttempts || 0 : 0) + 1;
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
    //   - 'pending'
    //   - 'advertised'
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

    const errorState = 'error';
    await updateStickerPackStatus(packId, errorState);
    if (stickerPackUpdated) {
      stickerPackUpdated(packId, {
        state: errorState,
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
