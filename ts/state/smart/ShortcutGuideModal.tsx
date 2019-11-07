import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { ShortcutGuideModal } from '../../components/ShortcutGuideModal';
import { StateType } from '../reducer';

import { countStickers } from '../../components/stickers/lib';
import { getIntl, getPlatform } from '../selectors/user';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
} from '../selectors/stickers';

type ExternalProps = {
  close: () => unknown;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { close } = props;

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
    }) === 0;

  const platform = getPlatform(state);

  return {
    close,
    hasInstalledStickers,
    platform,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartShortcutGuideModal = smart(ShortcutGuideModal);
