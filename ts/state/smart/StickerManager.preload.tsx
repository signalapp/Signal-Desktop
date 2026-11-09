// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo } from 'react';
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
import { useToastActions } from '../ducks/toast.preload.ts';
import { isFavoriteStickersEnabled as getIsFavoriteStickersEnabled } from '../../util/stickers.preload.ts';

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
    uninstallStickerPack,
    updateStickerPacksPositions,
  } = useStickersActions();
  const { closeStickerPackPreview } = useGlobalModalActions();
  const { showToast } = useToastActions();
  const { markStickerAsFavorite, setStickerManagerTab } = useStickersActions();

  const favoriteStickers = useSelector(getInstalledFavoriteStickers);
  const isFavoriteStickersEnabled = getIsFavoriteStickersEnabled();

  return (
    <StickerManager
      blessedPacks={blessedPacks}
      closeStickerPackPreview={closeStickerPackPreview}
      downloadStickerPack={downloadStickerPack}
      favoriteStickers={favoriteStickers}
      i18n={i18n}
      isFavoriteStickersEnabled={isFavoriteStickersEnabled}
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
