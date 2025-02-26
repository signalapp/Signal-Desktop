// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, reject, groupBy, values, chunk } from 'lodash';
import pMap from 'p-map';
import Queue from 'p-queue';

import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import { makeLookup } from '../util/makeLookup';
import { maybeParseUrl } from '../util/url';
import { getMessagesById } from '../messages/getMessagesById';
import * as Bytes from '../Bytes';
import * as Errors from './errors';
import { deriveStickerPackKey, decryptAttachmentV1 } from '../Crypto';
import { IMAGE_WEBP } from './MIME';
import { sniffImageMimeType } from '../util/sniffImageMimeType';
import type { AttachmentType, AttachmentWithHydratedData } from './Attachment';
import type {
  StickerType as StickerFromDBType,
  StickerPackType,
  StickerPackStatusType,
  UninstalledStickerPackType,
} from '../sql/Interface';
import { DataReader, DataWriter } from '../sql/Client';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { StickersStateType } from '../state/ducks/stickers';
import { MINUTE } from '../util/durations';
import { drop } from '../util/drop';
import { isNotNil } from '../util/isNotNil';
import { encryptLegacyAttachment } from '../util/encryptLegacyAttachment';
import { AttachmentDisposition } from '../util/getLocalAttachmentUrl';

export type ActionSourceType =
  | 'startup'
  | 'syncMessage'
  | 'storageService'
  | 'ui';

export type StickerType = {
  packId: string;
  stickerId: number;
  packKey: string;
  emoji?: string;
  data?: AttachmentType;
  path?: string;
  width?: number;
  height?: number;
  version?: 2;
  localKey?: string;
};
export type StickerWithHydratedData = StickerType & {
  data: AttachmentWithHydratedData;
};

export type RecentStickerType = Readonly<{
  stickerId: number;
  packId: string;
}>;

export type BlessedType = Pick<StickerPackType, 'key' | 'status'>;

export type DownloadMap = Record<
  string,
  {
    id: string;
    key: string;
    status?: StickerPackStatusType;
  }
>;

export type StickerPackPointerType = Readonly<{
  id: string;
  key: string;
}>;

export const STICKERPACK_ID_BYTE_LEN = 16;
export const STICKERPACK_KEY_BYTE_LEN = 32;

// Number of messages loaded and saved at the same time when resolving sticker
// pack references.
const RESOLVE_REFERENCES_BATCH_SIZE = 1000;

const BLESSED_PACKS: Record<string, BlessedType> = {
  '9acc9e8aba563d26a4994e69263e3b25': {
    key: 'Wm3/OUjCjvubeq+T7MN1xp/DFueAd+0mhnoU0QoPahI=',
    status: 'downloaded',
  },
  fb535407d2f6497ec074df8b9c51dd1d: {
    key: 'F+lxwTQDViJ4HS7iSeZHO3dFg3ULaMEbuCt1CcaLbf0=',
    status: 'downloaded',
  },
  e61fa0867031597467ccc036cc65d403: {
    key: 'E657GnQHMYKA6bOMEmHe044OcTi5+WSmzLtz5A9zeps=',
    status: 'downloaded',
  },
  cca32f5b905208b7d0f1e17f23fdc185: {
    key: 'i/jpX3pFver+DI9bAC7wGrlbjxtbqsQBnM1ra+Cxg3o=',
    status: 'downloaded',
  },
  ccc89a05dc077856b57351e90697976c: {
    key: 'RXMOYPCdVWYRUiN0RTemt9nqmc7qy3eh+9aAG5YH+88=',
    status: 'downloaded',
  },
  cfc50156556893ef9838069d3890fe49: {
    key: 'X1vqt9OCRDywCh5I65Upe2uMrf0GMeXQ2dyUnmmZ/0s=',
    status: 'downloaded',
  },
};

const STICKER_PACK_DEFAULTS: StickerPackType = {
  id: '',
  key: '',

  author: '',
  coverStickerId: 0,
  createdAt: 0,
  downloadAttempts: 0,
  status: 'ephemeral',
  stickerCount: 0,
  stickers: {},
  title: '',

  storageNeedsSync: false,
};

const VALID_PACK_ID_REGEXP = /^[0-9a-f]{32}$/i;

const DOWNLOAD_PRIORITY_NORMAL = 0;
const DOWNLOAD_PRIORITY_HIGH = 1;

let initialState: StickersStateType | undefined;
let packsToDownload: DownloadMap | undefined;
const downloadQueue = new Queue({ concurrency: 1, timeout: MINUTE * 30 });
const downloadQueueData = new Map<
  string,
  { depth: number; finalStatus: StickerPackStatusType | undefined }
>();

export async function load(): Promise<void> {
  const [packs, recentStickers] = await Promise.all([
    getPacksForRedux(),
    getRecentStickersForRedux(),
  ]);

  const blessedPacks: Record<string, boolean> = Object.create(null);
  for (const key of Object.keys(BLESSED_PACKS)) {
    blessedPacks[key] = true;
  }

  initialState = {
    packs,
    recentStickers,
    blessedPacks,
    installedPack: null,
  };

  packsToDownload = capturePacksToDownload(packs);
}

export async function createPacksFromBackup(
  packs: ReadonlyArray<StickerPackPointerType>
): Promise<void> {
  const known = new Set(packs.map(({ id }) => id));
  const pairs = packs.slice();
  const uninstalled = new Array<UninstalledStickerPackType>();

  for (const [id, { key }] of Object.entries(BLESSED_PACKS)) {
    if (known.has(id)) {
      continue;
    }

    // Blessed packs that are not in the backup were uninstalled
    pairs.push({ id, key });
    uninstalled.push({
      id,
      key: undefined,
      uninstalledAt: Date.now(),
      storageNeedsSync: false,
    });
  }

  const packsToStore = pairs.map(
    ({ id, key }): StickerPackType => ({
      ...STICKER_PACK_DEFAULTS,

      id,
      key,
      attemptedStatus: 'installed' as const,
      status: 'pending' as const,
    })
  );

  await DataWriter.createOrUpdateStickerPacks(packsToStore);
  await DataWriter.addUninstalledStickerPacks(uninstalled);

  packsToDownload = capturePacksToDownload(makeLookup(packsToStore, 'id'));
}

export async function getStickerPacksForBackup(): Promise<
  Array<StickerPackPointerType>
> {
  const result = new Array<StickerPackPointerType>();
  const stickerPacks = await DataReader.getAllStickerPacks();
  const uninstalled = new Set(
    (await DataReader.getUninstalledStickerPacks()).map(({ id }) => id)
  );
  for (const { id, key, status } of stickerPacks) {
    if (uninstalled.has(id)) {
      continue;
    }

    if (status === 'known' || status === 'ephemeral') {
      continue;
    }

    result.push({ id, key });
  }
  return result;
}

export function getDataFromLink(
  link: string
): undefined | StickerPackPointerType {
  const url = maybeParseUrl(link);
  if (!url) {
    return undefined;
  }

  const { hash } = url;
  if (!hash) {
    return undefined;
  }

  let params;
  try {
    params = new URLSearchParams(hash.slice(1));
  } catch (err) {
    return undefined;
  }

  const id = params.get('pack_id');
  if (!isPackIdValid(id)) {
    return undefined;
  }

  const key = params.get('pack_key');
  if (!key) {
    return undefined;
  }

  return { id, key };
}

export function getInstalledStickerPacks(): Array<StickerPackType> {
  const state = window.reduxStore.getState();
  const { stickers } = state;
  const { packs } = stickers;
  if (!packs) {
    return [];
  }

  const items = Object.values(packs);
  return items.filter(pack => pack.status === 'installed');
}

export function downloadQueuedPacks(): void {
  log.info('downloadQueuedPacks');
  strictAssert(packsToDownload, 'Stickers not initialized');

  const ids = Object.keys(packsToDownload);
  for (const id of ids) {
    const { key, status } = packsToDownload[id];

    // The queuing is done inside this function, no need to await here
    drop(
      downloadStickerPack(id, key, {
        finalStatus: status,
        suppressError: true,
        actionSource: 'startup',
      })
    );
  }

  packsToDownload = {};
}

function capturePacksToDownload(
  existingPackLookup: Record<string, StickerPackType>
): DownloadMap {
  const toDownload: DownloadMap = Object.create(null);

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
      void deletePack(id);
      return;
    }

    // We don't automatically download these; not until a user action kicks it off
    if (existing.status === 'known') {
      return;
    }

    if (doesPackNeedDownload(existing)) {
      const status =
        existing.attemptedStatus === 'installed' ? 'installed' : undefined;
      toDownload[id] = {
        id,
        key: existing.key,
        status,
      };
    }
  });

  return toDownload;
}

function doesPackNeedDownload(pack?: StickerPackType): boolean {
  if (!pack) {
    return true;
  }

  const { status, stickerCount } = pack;

  if ((status === 'installed' || status === 'downloaded') && stickerCount > 0) {
    return false;
  }

  // If we don't understand a pack's status, we'll download it
  // If a pack has any other status, we'll download it
  // If a pack has zero stickers in it, we'll download it

  // Note: If a pack downloaded with less than the expected number of stickers, we're
  //   okay with that.

  return true;
}

async function getPacksForRedux(): Promise<Record<string, StickerPackType>> {
  const [packs, stickers] = await Promise.all([
    DataReader.getAllStickerPacks(),
    DataReader.getAllStickers(),
  ]);

  const stickersByPack = groupBy(stickers, sticker => sticker.packId);
  const fullSet: Array<StickerPackType> = packs.map(pack => ({
    ...pack,
    stickers: makeLookup(stickersByPack[pack.id] || [], 'id'),
  }));

  return makeLookup(fullSet, 'id');
}

async function getRecentStickersForRedux(): Promise<Array<RecentStickerType>> {
  const recent = await DataReader.getRecentStickers();
  return recent.map(sticker => ({
    packId: sticker.packId,
    stickerId: sticker.id,
  }));
}

export function getInitialState(): StickersStateType {
  strictAssert(initialState !== undefined, 'Stickers not initialized');
  return initialState;
}

export function isPackIdValid(packId: unknown): packId is string {
  return typeof packId === 'string' && VALID_PACK_ID_REGEXP.test(packId);
}

export function redactPackId(packId: string): string {
  return `[REDACTED]${packId.slice(-3)}`;
}

function getReduxStickerActions() {
  const actions = window.reduxActions;
  strictAssert(actions && actions.stickers, 'Redux not ready');

  return actions.stickers;
}

function decryptSticker(packKey: string, ciphertext: Uint8Array): Uint8Array {
  const binaryKey = Bytes.fromBase64(packKey);
  const derivedKey = deriveStickerPackKey(binaryKey);

  // Note this download and decrypt in memory is okay because these files are maximum
  //   300kb, enforced by the server.
  const plaintext = decryptAttachmentV1(ciphertext, derivedKey);

  return plaintext;
}

async function downloadSticker(
  packId: string,
  packKey: string,
  proto: Proto.StickerPack.ISticker,
  { ephemeral }: { ephemeral?: boolean } = {}
): Promise<Omit<StickerFromDBType, 'isCoverOnly'>> {
  const { id, emoji } = proto;
  strictAssert(id != null, "Sticker id can't be null");

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('messaging is not available!');
  }

  const ciphertext = await messaging.getSticker(packId, id);
  const plaintext = decryptSticker(packKey, ciphertext);

  const sticker = ephemeral
    ? await window.Signal.Migrations.processNewEphemeralSticker(plaintext)
    : await window.Signal.Migrations.processNewSticker(plaintext);

  return {
    id,
    emoji: dropNull(emoji),
    ...sticker,
    packId,
  };
}

export async function savePackMetadata(
  packId: string,
  packKey: string,
  {
    messageId,
    stickerId,
    isUnresolved,
  }: { messageId: string; stickerId: number; isUnresolved: boolean }
): Promise<void> {
  const existing = getStickerPack(packId);
  if (existing) {
    return;
  }

  const { stickerPackAdded } = getReduxStickerActions();
  const pack = {
    ...STICKER_PACK_DEFAULTS,

    id: packId,
    key: packKey,
    status: 'known' as const,
  };
  stickerPackAdded(pack);

  await DataWriter.createOrUpdateStickerPack(pack);
  if (messageId) {
    await DataWriter.addStickerPackReference({
      messageId,
      packId,
      stickerId,
      isUnresolved,
    });
  }
}

export async function removeEphemeralPack(packId: string): Promise<void> {
  const existing = getStickerPack(packId);
  strictAssert(existing, `No existing sticker pack with id: ${packId}`);
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
  await pMap(paths, window.Signal.Migrations.deleteTempFile, {
    concurrency: 3,
  });

  // Remove it from database in case it made it there
  await DataWriter.deleteStickerPack(packId);
}

export async function downloadEphemeralPack(
  packId: string,
  packKey: string
): Promise<void> {
  const { stickerAdded, stickerPackAdded, stickerPackUpdated } =
    getReduxStickerActions();

  const existingPack = getStickerPack(packId);
  if (
    existingPack &&
    (existingPack.status === 'downloaded' ||
      existingPack.status === 'installed' ||
      existingPack.status === 'pending')
  ) {
    if (existingPack.status === 'pending') {
      log.info(
        `Ephemeral download for pending sticker pack ${redactPackId(
          packId
        )} requested, redownloading with priority.`
      );
      drop(downloadStickerPack(packId, packKey, { actionSource: 'ui' }));
    } else {
      log.warn(
        `Ephemeral download for sticker pack ${redactPackId(
          packId
        )} requested, we already know about it. Skipping.`
      );
    }
    return;
  }

  try {
    // Synchronous placeholder to help with race conditions
    const placeholder = {
      ...STICKER_PACK_DEFAULTS,

      id: packId,
      key: packKey,
      status: 'ephemeral' as const,
    };
    stickerPackAdded(placeholder);

    const { messaging } = window.textsecure;
    if (!messaging) {
      throw new Error('messaging is not available!');
    }

    const ciphertext = await messaging.getStickerPackManifest(packId);
    const plaintext = decryptSticker(packKey, ciphertext);
    const proto = Proto.StickerPack.decode(plaintext);
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
    const coverSticker = proto.stickers.filter(
      sticker => isNumber(sticker.id) && sticker.id === coverStickerId
    );
    if (coverSticker[0] && !coverProto.emoji) {
      coverProto.emoji = coverSticker[0].emoji;
    }

    const coverIncludedInList = nonCoverStickers.length < stickerCount;

    const pack = {
      ...STICKER_PACK_DEFAULTS,

      id: packId,
      key: packKey,
      coverStickerId,
      stickerCount,
      status: 'ephemeral' as const,
      title: proto.title ?? '',
      author: proto.author ?? '',
    };
    stickerPackAdded(pack);

    const downloadStickerJob = async (
      stickerProto: Proto.StickerPack.ISticker
    ): Promise<boolean> => {
      let stickerInfo;
      try {
        stickerInfo = await downloadSticker(packId, packKey, stickerProto, {
          ephemeral: true,
        });
      } catch (error: unknown) {
        log.error(
          `downloadEphemeralPack/downloadStickerJob error: ${Errors.toLogFormat(
            error
          )}`
        );
        return false;
      }
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
      return true;
    };

    // Download the cover first
    await downloadStickerJob(coverProto);

    // Then the rest
    const jobResults = await pMap(nonCoverStickers, downloadStickerJob, {
      concurrency: 3,
    });

    const successfulStickerCount = jobResults.filter(item => item).length;
    if (successfulStickerCount === 0 && nonCoverStickers.length !== 0) {
      throw new Error('downloadEphemeralPack: All stickers failed to download');
    }
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
      Errors.toLogFormat(error)
    );
  }
}

export type DownloadStickerPackOptions = Readonly<{
  actionSource: ActionSourceType;
  finalStatus?: StickerPackStatusType;
  suppressError?: boolean;
}>;

export async function downloadStickerPack(
  packId: string,
  packKey: string,
  options: DownloadStickerPackOptions
): Promise<void> {
  // Store finalStatus. When we click on a sticker we want to redownload with priority
  // while retaining the finalStatus, so we need a way to look up the last finalStatus.
  const data = downloadQueueData.get(packId);
  const finalStatus = options.finalStatus ?? data?.finalStatus;
  const depth = data ? data.depth + 1 : 1;
  downloadQueueData.set(packId, { depth, finalStatus });

  const queueOptions = {
    priority:
      options.actionSource === 'ui'
        ? DOWNLOAD_PRIORITY_HIGH
        : DOWNLOAD_PRIORITY_NORMAL,
  };

  // This will ensure that only one download process is in progress at any given time
  return downloadQueue.add(async () => {
    try {
      await doDownloadStickerPack(packId, packKey, { ...options, finalStatus });
    } catch (error) {
      log.error(
        'doDownloadStickerPack threw an error:',
        Errors.toLogFormat(error)
      );
    } finally {
      const dataAfter = downloadQueueData.get(packId);
      if (dataAfter) {
        if (dataAfter.depth <= 1) {
          downloadQueueData.delete(packId);
        } else {
          downloadQueueData.set(packId, {
            ...dataAfter,
            depth: dataAfter.depth - 1,
          });
        }
      }
    }
  }, queueOptions);
}

async function doDownloadStickerPack(
  packId: string,
  packKey: string,
  {
    finalStatus = 'downloaded',
    actionSource,
    suppressError = false,
  }: DownloadStickerPackOptions
): Promise<void> {
  const {
    stickerAdded,
    stickerPackAdded,
    stickerPackUpdated,
    installStickerPack,
  } = getReduxStickerActions();

  if (finalStatus !== 'downloaded' && finalStatus !== 'installed') {
    throw new Error(
      `doDownloadStickerPack: invalid finalStatus of ${finalStatus} requested.`
    );
  }

  const existing = getStickerPack(packId);
  if (!doesPackNeedDownload(existing)) {
    return;
  }

  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server is not available!');
  }

  // We don't count this as an attempt if we're offline
  const attemptIncrement = server.isOnline() ? 1 : 0;
  const downloadAttempts =
    (existing ? existing.downloadAttempts || 0 : 0) + attemptIncrement;
  if (downloadAttempts > 3) {
    log.warn(
      `Refusing to attempt another download for pack ${redactPackId(
        packId
      )}, attempt number ${downloadAttempts}`
    );

    if (existing && existing.status !== 'error') {
      await DataWriter.updateStickerPackStatus(packId, 'error');
      stickerPackUpdated(
        packId,
        {
          status: 'error',
        },
        { suppressError }
      );
    }

    return;
  }

  let coverProto: Proto.StickerPack.ISticker | undefined;
  let coverStickerId: number | undefined;
  let coverIncludedInList = false;
  let nonCoverStickers: Array<Proto.StickerPack.ISticker> = [];

  try {
    // Synchronous placeholder to help with race conditions
    const placeholder = {
      ...STICKER_PACK_DEFAULTS,

      id: packId,
      key: packKey,
      attemptedStatus: finalStatus,
      downloadAttempts,
      status: 'pending' as const,
    };
    stickerPackAdded(placeholder);

    const { messaging } = window.textsecure;
    if (!messaging) {
      throw new Error('messaging is not available!');
    }

    const ciphertext = await messaging.getStickerPackManifest(packId);
    const plaintext = decryptSticker(packKey, ciphertext);
    const proto = Proto.StickerPack.decode(plaintext);
    const firstStickerProto = proto.stickers ? proto.stickers[0] : undefined;
    const stickerCount = proto.stickers.length;

    coverProto = proto.cover || firstStickerProto;
    coverStickerId = dropNull(coverProto ? coverProto.id : undefined);

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
    const coverSticker = proto.stickers.filter(
      sticker => isNumber(sticker.id) && sticker.id === coverStickerId
    );
    if (coverSticker[0] && !coverProto.emoji) {
      coverProto.emoji = coverSticker[0].emoji;
    }

    coverIncludedInList = nonCoverStickers.length < stickerCount;

    // status can be:
    //   - 'known'
    //   - 'ephemeral' (should not hit database)
    //   - 'pending'
    //   - 'downloaded'
    //   - 'error'
    //   - 'installed'
    const pack: StickerPackType = {
      id: packId,
      key: packKey,
      attemptedStatus: finalStatus,
      coverStickerId,
      downloadAttempts,
      stickerCount,
      status: 'pending',
      createdAt: Date.now(),
      stickers: {},
      title: proto.title ?? '',
      author: proto.author ?? '',

      // Redux handles these
      storageNeedsSync: false,
    };
    await DataWriter.createOrUpdateStickerPack(pack);
    stickerPackAdded(pack);
  } catch (error) {
    log.error(
      `Error downloading manifest for sticker pack ${redactPackId(packId)}:`,
      Errors.toLogFormat(error)
    );

    const pack = {
      ...STICKER_PACK_DEFAULTS,

      id: packId,
      key: packKey,
      attemptedStatus: finalStatus,
      downloadAttempts,
      status: 'error' as const,
    };
    await DataWriter.createOrUpdateStickerPack(pack);
    stickerPackAdded(pack, { suppressError });

    return;
  }

  // We have a separate try/catch here because we're starting to download stickers here
  //   and we want to preserve more of the pack on an error.
  try {
    const downloadStickerJob = async (
      stickerProto: Proto.StickerPack.ISticker
    ): Promise<boolean> => {
      try {
        const stickerInfo = await downloadSticker(
          packId,
          packKey,
          stickerProto
        );
        const sticker = {
          ...stickerInfo,
          isCoverOnly:
            !coverIncludedInList && stickerInfo.id === coverStickerId,
        };
        await DataWriter.createOrUpdateSticker(sticker);
        stickerAdded(sticker);
        return true;
      } catch (error: unknown) {
        log.error(
          `doDownloadStickerPack/downloadStickerJob error: ${Errors.toLogFormat(
            error
          )}`
        );
        return false;
      }
    };

    // Download the cover first
    await downloadStickerJob(coverProto);

    // Then the rest
    const jobResults = await pMap(nonCoverStickers, downloadStickerJob, {
      concurrency: 3,
    });

    const successfulStickerCount = jobResults.filter(item => item).length;
    if (successfulStickerCount === 0 && nonCoverStickers.length !== 0) {
      throw new Error('doDownloadStickerPack: All stickers failed to download');
    }

    // Allow for the user marking this pack as installed in the middle of our download;
    //   don't overwrite that status.
    const existingStatus = getStickerPackStatus(packId);
    if (existingStatus === 'installed') {
      // No-op
    } else if (finalStatus === 'installed') {
      await installStickerPack(packId, packKey, {
        actionSource,
      });
    } else {
      // Mark the pack as complete
      await DataWriter.updateStickerPackStatus(packId, finalStatus);
      stickerPackUpdated(packId, {
        status: finalStatus,
      });
    }

    drop(safeResolveReferences(packId));
  } catch (error) {
    log.error(
      `Error downloading stickers for sticker pack ${redactPackId(packId)}:`,
      Errors.toLogFormat(error)
    );

    const errorStatus = 'error';
    await DataWriter.updateStickerPackStatus(packId, errorStatus);
    if (stickerPackUpdated) {
      stickerPackUpdated(
        packId,
        {
          attemptedStatus: finalStatus,
          status: errorStatus,
        },
        { suppressError }
      );
    }
  }
}

async function safeResolveReferences(packId: string): Promise<void> {
  try {
    await resolveReferences(packId);
  } catch (error) {
    const logId = `Stickers.resolveReferences(${redactPackId(packId)})`;
    log.error(`${logId}: failed`, Errors.toLogFormat(error));
  }
}

async function resolveReferences(packId: string): Promise<void> {
  const refs = await DataWriter.getUnresolvedStickerPackReferences(packId);
  if (refs.length === 0) {
    return;
  }

  const logId = `Stickers.resolveReferences(${redactPackId(packId)})`;
  log.info(`${logId}: resolving ${refs.length}`);

  const stickerIdToMessageIds = new Map<number, Array<string>>();
  for (const { stickerId, messageId } of refs) {
    let list = stickerIdToMessageIds.get(stickerId);
    if (list == null) {
      list = [];
      stickerIdToMessageIds.set(stickerId, list);
    }

    list.push(messageId);
  }

  await pMap(
    Array.from(stickerIdToMessageIds.entries()),
    ([stickerId, messageIds]) =>
      pMap(
        chunk(messageIds, RESOLVE_REFERENCES_BATCH_SIZE),
        async batch => {
          let attachments: Array<AttachmentType>;
          try {
            attachments = await pMap(
              messageIds,
              () => copyStickerToAttachments(packId, stickerId),
              { concurrency: 3 }
            );
          } catch (error) {
            log.error(
              `${logId}: failed to copy sticker ${stickerId}`,
              Errors.toLogFormat(error)
            );
            return;
          }
          const messages = await getMessagesById(batch);

          const saves = new Array<Promise<unknown>>();
          for (const [index, message] of messages.entries()) {
            const data = attachments[index];
            strictAssert(data != null, 'Missing copied data');

            const { sticker, sent_at: sentAt } = message.attributes;
            if (!sticker) {
              log.info(`${logId}: ${sentAt} has no sticker`);
              continue;
            }

            if (sticker?.data?.path) {
              log.info(`${logId}: ${sentAt} already downloaded`);
              continue;
            }

            if (sticker.packId !== packId || sticker.stickerId !== stickerId) {
              log.info(`${logId}: ${sentAt} has different sticker`);
              continue;
            }

            message.set({
              sticker: {
                ...sticker,
                data,
              },
            });

            saves.push(window.MessageCache.saveMessage(message));
          }

          await Promise.all(saves);
        },
        { concurrency: 1 }
      ),
    { concurrency: 3 }
  );
}

export function getStickerPack(packId: string): StickerPackType | undefined {
  const state = window.reduxStore.getState();
  const { stickers } = state;
  const { packs } = stickers;
  if (!packs) {
    return undefined;
  }

  return packs[packId];
}

export function getStickerPackStatus(
  packId: string
): StickerPackStatusType | undefined {
  const pack = getStickerPack(packId);
  if (!pack) {
    return undefined;
  }

  return pack.status;
}

export function getSticker(
  packId: string,
  stickerId: number
): StickerFromDBType | undefined {
  const pack = getStickerPack(packId);

  if (!pack || !pack.stickers) {
    return undefined;
  }

  return pack.stickers[stickerId];
}

export async function copyStickerToAttachments(
  packId: string,
  stickerId: number
): Promise<AttachmentType> {
  const sticker = getSticker(packId, stickerId);
  if (!sticker) {
    throw new Error(
      `copyStickerToAttachments: Failed to find sticker ${packId}/${stickerId}`
    );
  }

  const { path: stickerPath } = sticker;
  const absolutePath =
    window.Signal.Migrations.getAbsoluteStickerPath(stickerPath);
  const { path, size } =
    await window.Signal.Migrations.copyIntoAttachmentsDirectory(absolutePath);

  const newSticker: AttachmentType = {
    ...sticker,
    path,
    size,

    // Fall-back
    contentType: IMAGE_WEBP,
  };

  const data = await window.Signal.Migrations.readAttachmentData(newSticker);

  const sniffedMimeType = sniffImageMimeType(data);
  if (sniffedMimeType) {
    newSticker.contentType = sniffedMimeType;
  } else {
    log.warn(
      'copyStickerToAttachments: Unable to sniff sticker MIME type; falling back to WebP'
    );
  }

  return newSticker;
}

// In the case where a sticker pack is uninstalled, we want to delete it if there are no
//   more references left. We'll delete a nonexistent reference, then check if there are
//   any references left, just like usual.
export async function maybeDeletePack(packId: string): Promise<void> {
  // This hardcoded string is fine because message ids are GUIDs
  await deletePackReference('NOT-USED', packId);
}

// We don't generally delete packs outright; we just remove references to them, and if
//   the last reference is deleted, we finally then remove the pack itself from database
//   and from disk.
export async function deletePackReference(
  messageId: string,
  packId: string
): Promise<void> {
  const isBlessed = Boolean(BLESSED_PACKS[packId]);
  if (isBlessed) {
    return;
  }

  // This call uses locking to prevent race conditions with other reference removals,
  //   or an incoming message creating a new message->pack reference
  const paths = await DataWriter.deleteStickerPackReference({
    messageId,
    packId,
  });

  // If we don't get a list of paths back, then the sticker pack was not deleted
  if (!paths) {
    return;
  }

  const { removeStickerPack } = getReduxStickerActions();
  removeStickerPack(packId);

  await pMap(paths, window.Signal.Migrations.deleteSticker, {
    concurrency: 3,
  });
}

// The override; doesn't honor our ref-counting scheme - just deletes it all.
async function deletePack(packId: string): Promise<void> {
  const isBlessed = Boolean(BLESSED_PACKS[packId]);
  if (isBlessed) {
    return;
  }

  // This call uses locking to prevent race conditions with other reference removals,
  //   or an incoming message creating a new message->pack reference
  const paths = await DataWriter.deleteStickerPack(packId);

  const { removeStickerPack } = getReduxStickerActions();
  removeStickerPack(packId);

  await pMap(paths, window.Signal.Migrations.deleteSticker, {
    concurrency: 3,
  });
}

export async function encryptLegacyStickers(): Promise<void> {
  const CONCURRENCY = 32;

  const all = await DataReader.getAllStickers();

  log.info(`encryptLegacyStickers: checking ${all.length}`);

  const updated = (
    await pMap(
      all,
      async sticker => {
        try {
          return await encryptLegacySticker(sticker);
        } catch (error) {
          log.error('encryptLegacyStickers: processing failed', error);
          return undefined;
        }
      },
      {
        concurrency: CONCURRENCY,
      }
    )
  ).filter(isNotNil);

  await DataWriter.createOrUpdateStickers(
    updated.map(({ sticker }) => sticker)
  );

  log.info(`encryptLegacyStickers: updated ${updated.length}`);

  await pMap(
    updated,
    async ({ cleanup }) => {
      try {
        await cleanup();
      } catch (error) {
        log.error('encryptLegacyStickers: cleanup failed', error);
      }
    },
    {
      concurrency: CONCURRENCY,
    }
  );

  log.info(`encryptLegacyStickers: cleaned up ${updated.length}`);
}

async function encryptLegacySticker(
  sticker: StickerFromDBType
): Promise<
  { sticker: StickerFromDBType; cleanup: () => Promise<void> } | undefined
> {
  const { deleteSticker, readStickerData, writeNewStickerData } =
    window.Signal.Migrations;

  const updated = await encryptLegacyAttachment(sticker, {
    logId: 'sticker',
    readAttachmentData: readStickerData,
    writeNewAttachmentData: writeNewStickerData,
    disposition: AttachmentDisposition.Sticker,
  });

  if (updated !== sticker && sticker.path) {
    return { sticker: updated, cleanup: () => deleteSticker(sticker.path) };
  }

  return undefined;
}
