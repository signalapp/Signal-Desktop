import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { StickerManager } from '../../components/stickers/StickerManager';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers';

const mapStateToProps = (state: StateType) => {
  const blessedPacks = getBlessedStickerPacks(state);
  const receivedPacks = getReceivedStickerPacks(state);
  const installedPacks = getInstalledStickerPacks(state);

  return {
    blessedPacks,
    receivedPacks,
    installedPacks,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartStickerManager = smart(StickerManager);
