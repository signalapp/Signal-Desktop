// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { ShortcutGuideModal } from '../../components/ShortcutGuideModal';
import type { StateType } from '../reducer';

import { countStickers } from '../../components/stickers/lib';
import { getIntl, getPlatform } from '../selectors/user';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers';

const mapStateToProps = (state: StateType) => {
  const blessedPacks = getBlessedStickerPacks(state);
  const installedPacks = getInstalledStickerPacks(state);
  const knownPacks = getKnownStickerPacks(state);
  const receivedPacks = getReceivedStickerPacks(state);

  const hasInstalledStickers =
    countStickers({
      knownPacks,
      blessedPacks,
      installedPacks,
      receivedPacks,
    }) > 0;

  const platform = getPlatform(state);

  return {
    hasInstalledStickers,
    platform,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartShortcutGuideModal = smart(ShortcutGuideModal);
