// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { StickerManager } from '../../components/stickers/StickerManager.dom.js';
import { getIntl } from '../selectors/user.std.js';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers.std.js';
import { useStickersActions } from '../ducks/stickers.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

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
