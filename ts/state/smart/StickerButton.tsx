import { connect } from 'react-redux';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import { StickerButton } from '../../components/stickers/StickerButton';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
  getRecentlyInstalledStickerPack,
  getRecentStickers,
} from '../selectors/stickers';

const mapStateToProps = (state: StateType) => {
  const receivedPacks = getReceivedStickerPacks(state);
  const installedPacks = getInstalledStickerPacks(state);
  const blessedPacks = getBlessedStickerPacks(state);
  const knownPacks = getKnownStickerPacks(state);

  const recentStickers = getRecentStickers(state);
  const installedPack = getRecentlyInstalledStickerPack(state);
  const showIntroduction = get(
    state.items,
    ['showStickersIntroduction', 'value'],
    false
  );
  const showPickerHint =
    get(state.items, ['showStickerPickerHint', 'value'], false) &&
    receivedPacks.length > 0;

  return {
    receivedPacks,
    installedPack,
    blessedPacks,
    knownPacks,
    installedPacks,
    recentStickers,
    showIntroduction,
    showPickerHint,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, {
  ...mapDispatchToProps,
  clearShowIntroduction: () =>
    mapDispatchToProps.removeItem('showStickersIntroduction'),
  clearShowPickerHint: () =>
    mapDispatchToProps.removeItem('showStickerPickerHint'),
});

export const SmartStickerButton = smart(StickerButton);
