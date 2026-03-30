// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { StickerManager } from '../../components/stickers/StickerManager.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers.std.ts';
import { useStickersActions } from '../ducks/stickers.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';

export const SmartStickerManager = memo(function SmartStickerManager() {
  const i18n = useSelector(getIntl);
  const blessedPacks = useSelector(getBlessedStickerPacks);
  const receivedPacks = useSelector(getReceivedStickerPacks);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const knownPacks = useSelector(getKnownStickerPacks);

  const { downloadStickerPack, installStickerPack, uninstallStickerPack } =
    useStickersActions();
  const { closeStickerPackPreview } = useGlobalModalActions();

  return (
    <StickerManager
      blessedPacks={blessedPacks}
      closeStickerPackPreview={closeStickerPackPreview}
      downloadStickerPack={downloadStickerPack}
      i18n={i18n}
      installStickerPack={installStickerPack}
      installedPacks={installedPacks}
      knownPacks={knownPacks}
      receivedPacks={receivedPacks}
      uninstallStickerPack={uninstallStickerPack}
    />
  );
});
