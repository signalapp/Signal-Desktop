// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ShortcutGuideModal } from '../../components/ShortcutGuideModal.js';
import { countStickers } from '../../components/stickers/lib.js';
import { getIntl, getPlatform } from '../selectors/user.js';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';

export const SmartShortcutGuideModal = memo(function SmartShortcutGuideModal() {
  const i18n = useSelector(getIntl);
  const blessedPacks = useSelector(getBlessedStickerPacks);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const knownPacks = useSelector(getKnownStickerPacks);
  const receivedPacks = useSelector(getReceivedStickerPacks);
  const platform = useSelector(getPlatform);

  const { closeShortcutGuideModal } = useGlobalModalActions();

  const hasInstalledStickers = useMemo(() => {
    return (
      countStickers({
        knownPacks,
        blessedPacks,
        installedPacks,
        receivedPacks,
      }) > 0
    );
  }, [blessedPacks, installedPacks, knownPacks, receivedPacks]);

  return (
    <ShortcutGuideModal
      hasInstalledStickers={hasInstalledStickers}
      platform={platform}
      closeShortcutGuideModal={closeShortcutGuideModal}
      i18n={i18n}
    />
  );
});
