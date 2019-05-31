import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { StickerPreviewModal } from '../../components/stickers/StickerPreviewModal';
import { StateType } from '../reducer';

import { getIntl, getStickersPath, getTempPath } from '../selectors/user';
import {
  getBlessedPacks,
  getPacks,
  translatePackFromDB,
} from '../selectors/stickers';

type ExternalProps = {
  packId: string;
  readonly onClose: () => unknown;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { packId } = props;
  const stickersPath = getStickersPath(state);
  const tempPath = getTempPath(state);

  const packs = getPacks(state);
  const blessedPacks = getBlessedPacks(state);
  const pack = packs[packId];

  return {
    ...props,
    pack: pack
      ? translatePackFromDB(pack, packs, blessedPacks, stickersPath, tempPath)
      : undefined,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartStickerPreviewModal = smart(StickerPreviewModal);
