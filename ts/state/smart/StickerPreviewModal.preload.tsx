// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { StickerPreviewModal } from '../../components/stickers/StickerPreviewModal.dom.js';
import { getIntl } from '../selectors/user.std.js';
import {
  getBlessedPacks,
  getPacks,
  translatePackFromDB,
} from '../selectors/stickers.std.js';
import { useStickersActions } from '../ducks/stickers.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

export type ExternalProps = {
  packId: string;
};

export const SmartStickerPreviewModal = memo(function SmartStickerPreviewModal({
  packId,
}: ExternalProps) {
  const i18n = useSelector(getIntl);
  const packs = useSelector(getPacks);
  const blessedPacks = useSelector(getBlessedPacks);

  const { downloadStickerPack, installStickerPack, uninstallStickerPack } =
    useStickersActions();
  const { closeStickerPackPreview } = useGlobalModalActions();

  const packDb = packs[packId];
  const pack = packDb
    ? translatePackFromDB(packDb, packs, blessedPacks)
    : undefined;

  return (
    <StickerPreviewModal
      closeStickerPackPreview={closeStickerPackPreview}
      downloadStickerPack={downloadStickerPack}
      i18n={i18n}
      installStickerPack={installStickerPack}
      pack={pack}
      uninstallStickerPack={uninstallStickerPack}
    />
  );
});
