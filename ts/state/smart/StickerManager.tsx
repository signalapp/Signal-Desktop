// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { StickerManager } from '../../components/stickers/StickerManager';
import type { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers';

const mapStateToProps = (state: StateType) => {
  const blessedPacks = getBlessedStickerPacks(state);
  const receivedPacks = getReceivedStickerPacks(state);
  const installedPacks = getInstalledStickerPacks(state);
  const knownPacks = getKnownStickerPacks(state);

  return {
    blessedPacks,
    receivedPacks,
    installedPacks,
    knownPacks,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartStickerManager = smart(StickerManager);
