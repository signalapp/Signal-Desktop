// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { StickerManager } from '../../components/stickers/StickerManager.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import {
  getBlessedStickerPacks,
  getInstalledFavoriteStickers,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
  getStickerManagerTab,
} from '../selectors/stickers.std.ts';
import { useStickersActions } from '../ducks/stickers.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useToastActions } from '../ducks/toast.dom.ts';
import {
  isFavoriteStickersEnabled as getIsFavoriteStickersEnabled,
  isHidingStickerPacksEnabled as getIsHidingStickerPacksEnabled,
} from '../../util/stickers.preload.ts';
import { drop } from '../../util/drop.std.ts';

export const SmartStickerManager = memo(function SmartStickerManager() {
  const i18n = useSelector(getIntl);
  const blessedPacks = useSelector(getBlessedStickerPacks);
  const receivedPacks = useSelector(getReceivedStickerPacks);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const knownPacks = useSelector(getKnownStickerPacks);
  const tab = useSelector(getStickerManagerTab);

  const {
    downloadStickerPack,
    installStickerPack,
    markStickerAsFavorite,
    markStickerPackAsHidden,
    setStickerManagerTab,
    uninstallStickerPack,
    updateStickerPacksPositions,
  } = useStickersActions();
  const { closeStickerPackPreview } = useGlobalModalActions();
  const { showToast } = useToastActions();

  const favoriteStickers = useSelector(getInstalledFavoriteStickers);
  const isFavoriteStickersEnabled = getIsFavoriteStickersEnabled();
  const isHidingStickerPacksEnabled = getIsHidingStickerPacksEnabled();

  const hideStickerPack = useCallback(
    (packId: string) => {
      drop(markStickerPackAsHidden(packId, true));
    },
    [markStickerPackAsHidden]
  );

  return (
    <StickerManager
      blessedPacks={blessedPacks}
      closeStickerPackPreview={closeStickerPackPreview}
      downloadStickerPack={downloadStickerPack}
      favoriteStickers={favoriteStickers}
      hideStickerPack={hideStickerPack}
      i18n={i18n}
      isFavoriteStickersEnabled={isFavoriteStickersEnabled}
      isHidingStickerPacksEnabled={isHidingStickerPacksEnabled}
      installStickerPack={installStickerPack}
      installedPacks={installedPacks}
      knownPacks={knownPacks}
      markStickerAsFavorite={markStickerAsFavorite}
      receivedPacks={receivedPacks}
      uninstallStickerPack={uninstallStickerPack}
      updateStickerPacksPositions={updateStickerPacksPositions}
      showToast={showToast}
      setTab={setStickerManagerTab}
      tab={tab}
    />
  );
});
