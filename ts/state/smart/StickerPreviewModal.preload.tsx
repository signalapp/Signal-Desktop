// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo } from 'react';
import { useSelector } from 'react-redux';
import { StickerPreviewModal } from '../../components/stickers/StickerPreviewModal.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import {
  getBlessedPacks,
  getInstalledFavoriteStickers,
  getPacks,
  translatePackFromDB,
} from '../selectors/stickers.std.ts';
import { useStickersActions } from '../ducks/stickers.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import { isFavoriteStickersEnabled as getIsFavoriteStickersEnabled } from '../../util/stickers.preload.ts';

export type ExternalProps = {
  packId: string;
};

export const SmartStickerPreviewModal = memo(function SmartStickerPreviewModal({
  packId,
}: ExternalProps) {
  const i18n = useSelector(getIntl);
  const packs = useSelector(getPacks);
  const blessedPacks = useSelector(getBlessedPacks);

  const {
    downloadStickerPack,
    installStickerPack,
    markStickerAsFavorite,
    uninstallStickerPack,
  } = useStickersActions();
  const { closeStickerPackPreview } = useGlobalModalActions();
  const { showToast } = useToastActions();

  const favoriteStickers = useSelector(getInstalledFavoriteStickers);
  const isFavoriteStickersEnabled = getIsFavoriteStickersEnabled();

  const packDb = packs[packId];
  const pack = packDb
    ? translatePackFromDB(packDb, packs, blessedPacks)
    : undefined;

  return (
    <StickerPreviewModal
      closeStickerPackPreview={closeStickerPackPreview}
      downloadStickerPack={downloadStickerPack}
      favoriteStickers={favoriteStickers}
      i18n={i18n}
      installStickerPack={installStickerPack}
      isFavoriteStickersEnabled={isFavoriteStickersEnabled}
      markStickerAsFavorite={markStickerAsFavorite}
      pack={pack}
      uninstallStickerPack={uninstallStickerPack}
      showToast={showToast}
    />
  );
});
