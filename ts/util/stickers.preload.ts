// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import {
  downloadStickerPack,
  type FavoriteStickerType,
  maybeDeletePack,
  savePackMetadata,
  type StickerReferenceType,
} from '../types/Stickers.preload.ts';
import { strictAssert } from './assert.std.ts';
import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.ts';
import { deleteSticker } from './migrations.preload.ts';
import { redactPackId } from './Stickers.std.ts';

const log = createLogger('stickers');

export async function installFavoriteSticker(
  favoriteSticker: FavoriteStickerType,
  actionSource: 'ui' | 'storageService'
): Promise<void> {
  const { packId, packKey, stickerId } = favoriteSticker;
  strictAssert(packKey, 'packKey required to add pack');

  await savePackMetadata(packId, packKey, { resetDownloadAttempts: true });

  await downloadStickerPack(packId, packKey, {
    actionSource,
    finalStatus: 'known',
    favoriteStickerIds: [stickerId],
  });

  window.reduxActions.stickers.addFavoriteSticker({ packId, stickerId });
}

export async function uninstallFavoriteSticker({
  packId,
  stickerId,
}: StickerReferenceType): Promise<void> {
  const logId = `uninstallFavoriteSticker(${redactPackId(packId)})`;

  // This will not delete stickers if the pack was installed/downloaded, because
  // we expect the full pack to remain present in those cases
  const deletedStickerPath = await DataWriter.maybeDeleteSticker({
    packId,
    stickerId,
  });

  if (deletedStickerPath) {
    log.info(`${logId}: Deleting unreferenced sticker`);
    await deleteSticker(deletedStickerPath);

    const favorites = await DataReader.getFavoriteStickersFromPack(packId);
    if (favorites.length === 0) {
      log.info(`${logId}: Removed last favorite, maybe deleting pack`);
      await maybeDeletePack(packId);
    }
  }

  window.reduxActions.stickers.removeFavoriteSticker({ packId, stickerId });
}

export function isFavoriteStickersEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.stickerFavorites.beta',
    prodKey: 'desktop.stickerFavorites.prod',
  });
}

/**
 * Look for stickers in already downloaded/installed sticker packs and update
 * FavoriteSticker status to installed. Idempotent.
 * @param packId
 * @param stickerIds
 * @returns Array<number> stickerIds which were installed.
 */
export async function updateFavoriteStickersAlreadyInstalled(
  packId: string,
  stickerIds: Array<number>
): Promise<Array<number>> {
  const installedStickerIds = [];
  for (const stickerId of stickerIds) {
    // oxlint-disable-next-line no-await-in-loop
    if (!(await DataReader.getSticker({ packId, stickerId }))) {
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop
    await DataWriter.updateFavoriteStickerStatus(
      { packId, stickerId },
      'installed'
    );
    installedStickerIds.push(stickerId);
  }

  return installedStickerIds;
}
